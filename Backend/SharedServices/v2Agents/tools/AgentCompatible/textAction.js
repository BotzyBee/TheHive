/*
    Uses The Hive Plugin Tool Standard
*/

export const details = {
    toolName:   "aiTextAction",
    version:    "2026.1.4",
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
            "structuredOutput": {
            "type": "object",
            "description": "A JSON schema for the AI to follow for its response."
            }
        },
        "required": ["taskDescription"]
        }
};

function safeEmit(agent, message){
    if(agent && typeof agent.emitUpdateStatus === "function"){
        agent.emitUpdateStatus(message);
    }
}

/**
 * 
 * @param {Services} Shared - For passing the SharedServices object exported via 'Services' 
 * @param {object}  options
 * @param {string}  options.taskDescription - Mandatory. The task or action needing undertaken.
 * @param {string}  options.context - Optional. For passing any context or reference text along with the task. 
 * @param {object}  options.structuredOutput - Optional (Schema). If used the AI model will output a structured output to match this schema.
 * @returns {Result[[ TextMessage ] | string ] } - Returns a result or string depending if Ok or Err.
 */
export async function run( 
    Shared, 
    params = {},
    agent = {}
){  
    // Destructure input
    const { taskDescription, context, structuredOutput } = params;
    const { aiSettings } = agent?.aiSettings || {};
    if (structuredOutput) aiSettings.structuredOutput = structuredOutput;
    
    // Catch bad params
    if(taskDescription == null){
        return Shared.v2Core.Helpers.Err(`Error (AiTextAction Tool) - Input taskDescription missing or null.`);
    }
    // Prepare any context / reference text
    let ref = context ? context : "";
    if(typeof ref != "string"){
        ref = JSON.stringify(ref);
    }
    // Make the call
    safeEmit(agent, `Crafting text using AI - 🤖🐝`);
    const aiCall =  Shared.callAI.aiFactory();
    const sysText = "You are a tool which extracts, summarises, modifies a given text input. Focus on quality and accuracy. Use UK English.";
    let usrText = `Here are your instructions <task>${taskDescription}</task>. Here is the reference text <reference>${ref}</reference>`;
    let call = await aiCall.generateText(sysText, usrText, aiSettings );
    if(call.isErr()){
        return Shared.v2Core.Helpers.Err(`Error (AiTextAction -> Generate Text) : ${call.value}`);
    }
    let message = new  Shared.aiAgents.Classes.TextMessage({
        role: Shared.aiAgents.Constants.Roles.Tool, 
        mimeType: "text/plain", 
        textData: call.value,
        toolName: "AiTextAction",
        instructions: taskDescription
    });
    return Shared.v2Core.Helpers.Ok([message]);
}

