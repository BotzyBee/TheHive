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

// 
// Handles nesting and primative types.
/**
 * Parses an array of enteries into an object. 
 * @param {array(object)} entries -  [ {key: string, type: string, value: any}, ... ]
 * @param {number} depth - IGNORE - used for recursive depth counting. 
 * @param {number} maxDepth - Used for setting the max depth for recursive loops. Default is 10.
 * @returns {object | Err(string) } - doesn't return Ok() just the value. Err() class used to indicate error. 
 */
export function buildObject(entries, depth = 0, maxDepth = 10) {
    if (depth > maxDepth) return Err(`Max depth ${maxDepth} exceeded.`);
    if (!Array.isArray(entries)) return Err(`Input is not an array.`);

    // Handle Bulk (Returning Array)
    if (entries.length > 0 && entries.every(Array.isArray)) {
        return entries.map(group => buildObject(group, depth + 1, maxDepth));
    }
    const result = {};
    for (const entry of entries) {
        if (!entry || typeof entry !== 'object') continue;
        const { key, type, value } = entry;

        // CRITICAL FIX: Prevent result["undefined"]
        if (key === undefined) continue;

        if (type === "object") {
            const nested = buildObject(value, depth + 1, maxDepth);
            if (nested?.outcome === "Error") return nested;
            result[key] = nested;
        } 
        else if (type === "array" && Array.isArray(value)) {
            const processedArray = [];
            for (const item of value) {
                if (item?.type === "object") {
                    const nested = buildObject(item.value, depth + 1, maxDepth);
                    if (nested?.outcome === "Error") return nested; // Proper bubbling
                    processedArray.push(nested);
                } else {
                    processedArray.push(item);
                }
            }
            result[key] = processedArray;
        } 
        else {
            result[key] = value;
        }
    }
    return result;
}