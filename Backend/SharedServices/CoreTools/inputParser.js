import nunjucks from 'nunjucks';
import { Ok, Err } from '../Utils/helperFunctions.js';

const nunEnv = nunjucks.configure({
    autoescape: false, // Auto-escape HTML by default for security
});

// This filter will stringify the input data into a JSON string.
nunEnv.addFilter('tojson', function(obj, spaces) {
    const jsonString = JSON.stringify(obj, null, spaces || 0);
    return jsonString;
});

/**
 * Used for crafting input parameters for AI calls. 
 * @param {array(objects)} templateArray - Example input [ { key: 'str', type: 'string', value: '<<valStr>>' }, ... ]
 * @param {object} dataObject -  The data that will be injected to the object - Eg { valStr: "ABC" }
 * @returns { Result(object) } - An object with the keys of the template and data from the data object.
 */
export function parseNunjucksTemplate(templateArray, dataObject) {
    try {
        const rawObj = buildObject(templateArray);
        // Check if buildObject returned an Error Result instead of a raw object
        if (rawObj && typeof rawObj.isErr === 'function' && rawObj.isErr()) {
            return rawObj; 
        }
        let templateString = JSON.stringify(rawObj);

        // REFINED REGEX: 
        // 1. Target specifically quoted placeholders for JSON casting
        // 2. Target bare placeholders for standard string injection
        templateString = templateString
            .replace(/"<<(.+?)>>"/g, '{{ $1 | tojson }}') 
            .replace(/<<(.+?)>>/g, '{{ $1 }}');

        const rendered = nunEnv.renderString(templateString, dataObject);
        
        return Ok(JSON.parse(rendered));
    } catch (error) {
        return Err({
            message: "Template parsing failed",
            detail: error.message,
            context: templateArray
        });
    }
}

 
/**
 * Adds Data to a string from provided data-object.
 * (Used for AI Agent finalisation to avoid limiting output to AI model response size &  research agent editor)
 * @param {string} inputString - Example -"The status is << complexObj.status >>" 
 * @param {object} dataObject - { complexObj: { id: 1, status: "active" } }
 * @returns {string} - merges the data from the data object. Eg.
 * The example above outputs 'The status is "active"'
 */
export function addAnyDirectData(inputString, dataObject) {
  let templateString = inputString;
  //Input validation
    if (typeof templateString !== 'string') {
      return Err(`Error (addAnyDirectData) : templateString must be a string`);
    }
    if (typeof dataObject !== 'object' || dataObject === null || Array.isArray(dataObject)) {
      return Err(`Error (addAnyDirectData) : dataObject must be an object`)
    }
    if (templateString.includes("<<")) {
      templateString = swapPlaceholders(templateString, false);
    } else {
      // No data needing added;
      return Ok(inputString);
    }
    // Parse to nunJucks template
    try {
        let renderedText = nunjucks.renderString(templateString, dataObject);
        return Ok(renderedText);
    } catch (error) {
      return Err(`Error (addAnyDirectData) : ${error}`)
    }
}

// helper for above functions.
function swapPlaceholders(inputString = "", convertToJson = true) {
    // Regex breakdown:
    // 1. (['"])?           -> Optional opening quote (Group 1)
    // 2. <<\s*(.+?)\s*>>   -> The placeholder and content (Group 2)
    // 3. \1?               -> Matches the same quote from Group 1, if it existed
    const regex = /(['"])?<<\s*(.+?)\s*>>\1/g;

    return inputString.replace(regex, (match, quote, path) => { // match not used but needed.
        const cleanPath = path.trim();

        // If it was wrapped in quotes OR if convertToJson is explicitly true
        // we use the | tojson pipe.
        if (quote || convertToJson) {
            return `{{ ${cleanPath} | tojson }}`;
        }

        return `{{ ${cleanPath} }}`;
    });
}

/**
 * Parses an array of entries into an object.
 * @param {Object[]} entries - [ {key: string, type: string, value: any}, ... ]
 * @param {number} [depth=0] - Used for recursive depth counting.
 * @param {number} [maxDepth=10] - Max depth for recursive loops.
 * @returns {Object|Object[]} - Returns the parsed object or an array of objects.
 */
export function buildObject(entries, depth = 0, maxDepth = 10) {
    // 1. Safety Checks
    if (depth > maxDepth) return { outcome: "Error", message: `Max depth ${maxDepth} exceeded.` };
    if (!Array.isArray(entries)) return { outcome: "Error", message: `Input is not an array.` };

    // 2. Handle Bulk (Array of Arrays)
    // If every top-level element is an array, we process them individually.
    if (entries.length > 0 && entries.every(Array.isArray)) {
        return entries.map(group => buildObject(group, depth + 1, maxDepth));
    }

    const result = {};

    for (const entry of entries) {
        if (!entry || typeof entry !== 'object') continue;
        
        const { key, type, value } = entry;
        if (key === undefined) continue;

        // 3. Handle Nested Objects
        if (type === "object") {
            const nested = buildObject(value, depth + 1, maxDepth);
            if (nested?.outcome === "Error") return nested; // Bubble up error
            result[key] = nested;
        } 
        // 4. Handle Arrays
        else if (type === "array" && Array.isArray(value)) {
            const processedArray = value.map(item => {
                // If the item inside the array is itself a "nested object" entry
                if (item?.type === "object") {
                    const nested = buildObject(item.value, depth + 1, maxDepth);
                    return nested; 
                }
                // FIX: Return the value property, not the whole entry object
                return item?.value !== undefined ? item.value : item;
            });

            // Check if any recursive calls in the map returned an error
            const errorFound = processedArray.find(i => i?.outcome === "Error");
            if (errorFound) return errorFound;

            result[key] = processedArray;
        } 
        // 5. Primative / Default
        else {
            result[key] = value;
        }
    }

    return result;
}

export const parserPrompts = {
    craftParams: {
            sys: `You are an AI agent tasked with building input parameter objects.
The final output should always be an array of objects where each object has this shape: { key: string, type: string, value: any }.
Use the input schema to decide what keys and values you need to add to the array.
You will also be given an string with context data which will be useful when crafting the parameters.
Do NOT try to answer the query and do NOT add your own thoughts or comments to the output.

In the value field you can include data directly or include a reference to the context data via a property access path.
Any property access paths must be wrapped in << >> and have the type field set to 'ref'.
Note use an array if you want to combine multiple property access paths - example: [<< path.1 >>, << path.here >>, << another.path >>] .
If you are wanting to output mutiple objects you should nest them in the output array - example: [ [...array of objects] ,  [...array of objects] ]

Examples of how to use property access paths (if needed):
contextData: { ACT_XXXX: { tool: "the tool used", action: "what the tool did.", data: { a: "some output data", b: false }} }
param output = [
    { key : 'key_from_schema' , type: 'ref', value: '<< contextData.ACT_XXXX.data.b >>' },
    { key : 'key_from_schema2' , type: 'ref', value: '<< contextData.ACT_XXXX.data.a >> can be combined in the output.' }
]`,
    usr: (task, contextObject, toolSchema) => {
        return `<task> ${task} </task>
If there is any context to help you it will be here: <context> ${contextObject} </context>
Here is the tool input parameters schema <tool>${toolSchema}</tool>
Remember you can use property access paths or direct responses when crafting the input params.
Check you are providing params for all inputs specified in the schema - do not miss any that are required.
Your output must be an array of { key: string, type: string, value: any } objects`;
    },
    schema: {
        "type": "object",
        "description": "An object containing a 'params' property, where 'params' is an array of any type",
        "properties": {
            "params": {
                "type": "array",
                "items": {
                    "additionalProperties": true,
                    "default": null
                }
            }
        },
        "required": ["params"]
        },
    },
    }