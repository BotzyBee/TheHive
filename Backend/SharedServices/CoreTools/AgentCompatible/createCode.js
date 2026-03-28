/*
    Uses The Hive Plugin Tool Standard
*/
export const details = {
    toolName:   "createCodeTool",
    version:    "2026.0.1",
    creator:    "Botzy Bee",
    overview:   "This tool uses AI to create, check or modify code. It can also answer queries about coding or code."+
    " The Tool can output in a range of common code languages - for example HTML, Javascript, python, rust, CSS.  \n"+
    " Great for frontend or backend development. This tool DOES NOT execute code.",
    guide:      null,  
    inputSchema: {
    "type": "object",
    "properties": {
        "taskDescription": {
        "type": "string",
        "description": "The task or action needing undertaken."
        },
        "context": {
        "type": "string",
        "description": "For passing any context or reference code along with the task. This can be code needing edited or checked"
        },
        "model": {
        "type": "string",
        "description": "For passing a specific model if required."
        },
        "quality": {
        "type": "number",
        "description": "Quality level: 1 is low, 3 is high.",
        "minimum": 1,
        "maximum": 3
        },
        "randomModel": {
        "type": "boolean",
        "description": "If true, AI will use a random provider that matches the specs requested."
        }
    },
    "required": ["taskDescription"]
    }
};

/**
 * Uses Specific coding models to create code.
 * @param {Services} Shared - For passing the SharedServices object exported via 'Services' 
 * @param {object}  options
 * @param {string}  options.taskDescription - Mandatory. The task or action needing undertaken.
 * @param {string}  options.context - Optional. For passing any context or reference text along with the task. 
 * @param {string}  options.model - Optional. For passing a specific model if required
 * @param {number}  options.quality - Optional. 1 is low, 3 is high.
 * @param {boolean} options.randomModel - If true, AI will use a random provider that matches the specs requested.
 * @returns {Result[ [ TextMessage ] | string ] } - Returns Result[ TextMessage, ... ]
 */
export async function run( 
    Shared, 
    params = {}
){  
    // Destructure input
    const { taskDescription, context } = params;
    // Catch bad params
    if(taskDescription == null){
        return Shared.Utils.Err(`Error (createCodeTool) - Input taskDescription missing or null.`);
    }
    // Prepare any context / reference text
    let ref = context ? context : "";
    if(typeof ref != "string"){
        ref = JSON.stringify(ref);
    }
    // Make the call
    const aiCall = new Shared.AiCall.AiCall();
    const sysText = "You are an expert Software Architect and Senior Full-Stack Developer." 
    +" Your goal is to produce 'production-ready' code that balances immediate functionality with long-term maintainability." +
    " Favor composable functions and classes over monolithic blocks. Always use strict typing (e.g., TypeScript, Python type hints) where available and the most recent standards (eg ES6 for Javascript)."+
    " Include error handling, edge-case validation, and clear logging. Write expressive variable names. Add comments only to explain 'why,' not 'what.'"+
    "IMPORTANT : Use a Testing Mindset - Structure code so it is easily testable (Dependency Injection, Pure Functions). "+
    "Output : the mimeType must match the type of code returned in codeOutput - for example Javascript should be text/javascript, HTML should be text/html. text/plain should be avoided unless the output should be a txt file." 
    +"GuidanceText is for additional plain text giving guidance or explanation of the code.";
    let usrText = `Here are your instructions <task>${taskDescription}</task>. Here is any reference text / code <reference>${ref}</reference>`;
    const outputSchema = {
        "type": "object",
        "properties": {
            "mimeType": {
            "type": "string",
            "description": "The type of code generated, e.g., 'text/html' or 'text/javascript'."
            },
            "codeOutput": {
            "type": "string",
            "description": "The actual generated source code."
            },
            "guidanceText": {
            "type": "string",
            "description": "Optional supporting text or explanation to accompany the code."
            }
        },
        "required": [
            "mimeType",
            "codeOutput"
        ],
        "additionalProperties": false
        }
    params.structuredOutput = outputSchema;
    // Structured Output! - Code & description & mime
    let call = await aiCall.generateCode(sysText, usrText, params);
    if(call.isErr()){
        return Shared.Utils.Err(`Error (createCodeTool -> Generate Text) : ${call.value}`);
    }
    let retAR = [];
    retAR.push(
        new Shared.Classes.TextMessage({
        role: Shared.Classes.Roles.Tool, 
        mimeType: call.value.mimeType, 
        textData: call.value.codeOutput,
        toolName: "createCodeTool",
        instructions: "CODE Output - "+taskDescription
    }));
    if(call.value?.guidanceText != null ){
        retAR.push( new Shared.Classes.TextMessage({
            role: Shared.Classes.Roles.Tool, 
            mimeType: "text/plain", 
            textData: call.value.guidanceText,
            toolName: "createCodeTool",
            instructions: "Guidance Text - "+taskDescription
        }));
    }

    return Shared.Utils.Ok(retAR);
}

