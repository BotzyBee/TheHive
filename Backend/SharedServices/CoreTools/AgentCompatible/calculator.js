/*
    Uses The Hive Plugin Tool Standard
*/
export const details = {
    toolName:   "calculatorTool",
    version:    "2026.0.1",
    creator:    "Botzy Bee",
    overview:   "A tool for calculating a valid mathematical expression string. Supports +, -, *, /, brackets, and decimals. " + 
        "Example : (1 + 3) / 2). This tool acts as a calculator. The tool cannot perform any other function.", 
    guide:      null,  
    inputSchema: {
        "type": "object",
        "properties": {
            "expression": {
            "type": "string",
            "description": "The math expression that will be calculated. For example '(1 + 3) / 2)'"
            },
        },
        "required": [
            "expression"
        ],
        "additionalProperties": false
        }
    };

/**
 * Calculates the value based on math expression.
 * @param {Services} Shared - For passing the SharedServices object exported via 'Services' 
 * @param {object}  options
 * @param {string}  options.expression - The relative path to where the file should be saved (within the knowledgebase)
 * @returns {Result[ [TextMessage ] | string ] } - Returns a result or string depending if Ok or Err.
 */
export async function run( 
    Shared, 
    params = {}
){  
    // Destructure input
    let { expression } = params;

    // catch bad params
    if (expression == null || typeof expression !== 'string' || expression.trim() === '') {
        return Shared.Utils.Err(`Error (calculatorTool): Missing or invalid 'expression' parameter.`);
    }

    try {
        // Evaluate using mathjs
        const result = Shared.Utils.evaluateHelper(expression);
        let message = new Shared.Classes.TextMessage({
            role: Shared.Classes.Roles.Tool, 
            mimeType: "text/plain", 
            textData: `The result of '${expression}' is ${result}`,
            toolName: "calculatorTool",
            instructions: `Calculate ${expression}`
        });
        return Shared.Utils.Ok([message]);
    } catch (error) {
        return Shared.Utils.Err(`Error (calculatorTool -> mathjs.evaluate): ${error.message || error}`);
    }
}