/*
    Uses The Hive Plugin Tool Standard
*/
export const details = {
    toolName:   "aiTextAction",
    version:    "2026.0.1",
    creator:    "Botzy Bee",
    overview:   "This tool uses AI to create text, summarise text, extract information or modify a given text input. \n"+
                "This tool DOES NOT perform research, create code or find information from any sources.", 
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
            "description": "Optional context or reference text for the task."
            },
            "model": {
            "type": "string",
            "description": "A specific AI model identifier."
            },
            "quality": {
            "type": "number",
            "description": "Quality level of the output.",
            "minimum": 1,
            "maximum": 3
            },
            "structuredOutput": {
            "type": "object",
            "description": "A JSON schema for the AI to follow for its response."
            },
            "randomModel": {
            "type": "boolean",
            "description": "If true, uses a random provider matching the requested specs."
            }
        },
        "required": ["taskDescription"]
        }
};

/**
 * 
 * @param {Services} Shared - For passing the SharedServices object exported via 'Services' 
 * @param {object}  options
 * @param {string}  options.taskDescription - Mandatory. The task or action needing undertaken.
 * @param {string}  options.context - Optional. For passing any context or reference text along with the task. 
 * @param {string}  options.model - Optional. For passing a specific model if required
 * @param {number}  options.quality - Optional. 1 is low, 3 is high.
 * @param {object}  options.structuredOutput - Optional (Schema). If used the AI model will output a structured output to match this schema.
 * @param {boolean} options.randomModel - If true, AI will use a random provider that matches the specs requested.
 * @returns {Result[[TextMessage | ImageMessage | AudioMessage | DataMessage] | string ] } - Returns a result or string depending if Ok or Err.
 */
export async function run( 
    Shared, 
    params = {}
){  
    // Destructure input
    const { taskDescription, context } = params;
    // Catch bad params
    if(taskDescription == null){
        return Shared.Utils.Err(`Error (AiTextAction Tool) - Input taskDescription missing or null.`);
    }
    // Prepare any context / reference text
    let ref = context ? context : "";
    if(typeof ref != "string"){
        ref = JSON.stringify(ref);
    }
    // Make the call
    const aiCall = new Shared.AiCall.AiCall();
    const sysText = "You are a tool which extracts, summarises, modifies a given text input. Focus on quality and accuracy. Use UK English.";
    let usrText = `Here are your instructions <task>${taskDescription}</task>. Here is the reference text <reference>${ref}</reference>`;
    let call = await aiCall.generateText(usrText, sysText, params );
    if(call.isErr()){
        return Shared.Utils.Err(`Error (AiTextAction -> Generate Text) : ${call.value}`);
    } Shared.Classes.Roles.Tool
    let message = new Shared.Classes.TextMessage({
        role: Shared.Classes.Roles.Tool, 
        mimeType: "text/plain", 
        textData: call.value,
        toolName: "AiTextAction",
        instructions: taskDescription
    });
    return Shared.Utils.Ok([message]);
}

