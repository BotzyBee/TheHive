import nunjucks from 'nunjucks';
import { Ok, Err } from '../Utils/helperFunctions.js';

const nunEnv = nunjucks.configure({
    autoescape: false, // Auto-escape HTML by default for security
});

// This filter will stringify the input data into a JSON string.
nunEnv.addFilter('tojson', function(obj, spaces) {
    // If the object is undefined, return the string "null" 
    // so the JSON remains valid: {"key": null}
    if (typeof obj === 'undefined') {
        return 'null';
    }
    return JSON.stringify(obj, null, spaces || 0);
});

/**
 * Updated to handle "Bad control character" errors by automatically 
 * escaping partial string injections.
 */
export function parseNunjucksTemplate(templateArray, dataObject) {
    try {
        const rawObj = buildObject(templateArray);
        
        if (rawObj && typeof rawObj.isErr === 'function' && rawObj.isErr()) {
            return rawObj; 
        }

        let templateString = JSON.stringify(rawObj);

        // Handle FULL replacements: "{{ item }}" -> {{ item | tojson }}
        // This handles objects, arrays, and strings that occupy the entire field.
        templateString = templateString.replace(/"\{\{\s*(.+?)\s*\}\}"/g, (match, path) => {
            return path.includes('| tojson') ? `{{ ${path} }}` : `{{ ${path} | tojson }}`;
        });

        // Handle PARTIAL injections: "Text {{ item }} Text"
        // We apply a manual escape chain for JSON safety (newlines, tabs, quotes).
        // We use | safe at the end to prevent Nunjucks from doing HTML escaping (like &amp;).
        const jsonEscapeChain = ` | replace('\\\\', '\\\\\\\\') | replace('"', '\\\\"') | replace('\\n', '\\\\n') | replace('\\r', '\\\\r') | replace('\\t', '\\\\t') | safe`;

        templateString = templateString.replace(/\{\{\s*(.+?)\s*\}\}/g, (match, path) => {
            // Skip if it already has tojson or our escape chain
            if (path.includes('| tojson') || path.includes('| replace')) {
                return `{{ ${path} }}`;
            }
            return `{{ ${path}${jsonEscapeChain} }}`;
        });

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
 * Helper to swap placeholders in standard strings.
 */
function swapPlaceholders(inputString = "", convertToJson = true) {
    const regex = /(['"])?\{\{\s*(.+?)\s*\}\}\1/g;

    return inputString.replace(regex, (match, quote, path) => {
        const cleanPath = path.trim();
        const alreadyHasToJson = cleanPath.includes('| tojson');

        // If it was wrapped in quotes, it needs to be JSON safe.
        if ((quote || convertToJson) && !alreadyHasToJson) {
            return `{{ ${cleanPath} | tojson }}`;
        }

        return `{{ ${cleanPath} }}`;
    });
}

 
/**
 * Adds Data to a string from provided data-object.
 * @param {string} inputString - "The status is {{ complexObj.status }}" 
 * @param {object} dataObject - { complexObj: { status: "active" } }
 * @returns {Result} - 'The status is active'
 */
export function addAnyDirectData(inputString, dataObject) {
    let templateString = inputString;

    if (typeof templateString !== 'string') {
        return Err(`Error (addAnyDirectData) : templateString must be a string`);
    }
    if (typeof dataObject !== 'object' || dataObject === null || Array.isArray(dataObject)) {
        return Err(`Error (addAnyDirectData) : dataObject must be an object`);
    }

    // Check for standard Nunjucks braces
    if (templateString.includes("{{")) {
        templateString = swapPlaceholders(templateString, false);
    } else {
        return Ok(inputString);
    }

    try {
        // Note: Using 'nunjucks' or your 'nunEnv' instance consistently
        let renderedText = nunjucks.renderString(templateString, dataObject);
        return Ok(renderedText);
    } catch (error) {
        return Err(`Error (addAnyDirectData) : ${error.message}`);
    }
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
Any property access paths must be wrapped in {{ }} and have the type field set to 'ref'.
Note use an array if you want to combine multiple property access paths - example: [{{ path.1 }}, {{ path.here }}, {{ another.path }}]
When accessing an element in an array use bracket notation (data[0] NOT data.0 ). 

Examples of how to use property access paths (if needed):
context: { ACT_XXXX: { tool: "the tool used", action: "what the tool did.", data: { a: "some output data", b: false }} }
param output = [
    { key : 'key_from_schema' , type: 'ref', value: '{{ context.ACT_XXXX.data.b }}' },
    { key : 'key_from_schema2' , type: 'ref', value: '{{ context.ACT_XXXX.data.a }} can be combined in the output.' }
]`,
    usr: (task, contextObject, toolSchema, toolGuide, errors) => {
        return `<task> ${task} </task>
If there is any context to help you it will be here: <context> ${contextObject} </context>
Here is the tool input parameters schema <tool>${toolSchema}</tool>
Here is a guide on how to use the tool (may be empty if no guide provided): <guide> ${toolGuide} </guide>
Remember you can use property access paths or direct responses when crafting the input params.
Check you are providing params for all inputs specified in the schema - do not miss any that are required.
If there are any errors from previous steps, they will be provided here: <errors> ${errors} </errors>
Your output must be an array of { key: string, type: string, value: any } objects`;
    },
        schema: {
        "type": "object",
        "properties": {
            "params": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                "key": { "type": "string" },
                "type": { "type": "string" },
                "value": {
                    "description": "The value associated with the key.",
                    "anyOf": [
                    { "type": "string" },
                    { "type": "number" },
                    { "type": "boolean" },
                    { "type": "null" },
                    { 
                        "type": "object", 
                        "properties": {}, 
                        "additionalProperties": false 
                    },
                    { 
                        "type": "array", 
                        "items": { "type": "string" } 
                    }
                    ]
                }
                },
                "required": ["key", "type", "value"],
                "additionalProperties": false
            }
            }
        },
        "required": ["params"],
        "additionalProperties": false
        },
    },
    }