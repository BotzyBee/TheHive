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
 * @returns {Result[[ TextMessage ] | string ] } - Returns a result or string depending if Ok or Err.
 */
export async function run( 
    Shared, 
    params = {},
    agent = {}
){  
    // Destructure input
    const { taskDescription, context } = params;
    const { aiSettings = {}} = agent || {};

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
    const aiCall =  await Shared.callAI.aiFactory();
    const sysText = "You are a tool which extracts, summarises, modifies a given text input. Focus on quality and accuracy. Use UK English."+
    "As well as your text response, you must also provide a file extension type (ext) - eg 'txt', 'md', 'js', 'html' - so the content can be saved correctly.";
    let usrText = `Here are your instructions <task>${taskDescription}</task>. Here is the reference text <reference>${ref}</reference>`;
    let call = await aiCall.generateText(sysText, usrText, { ...aiSettings, structuredOutput: {
            "type": "object",
            "description": "An object containing textOutput and ext properties",
            "properties": {
                "textOutput": { "type": "string", "description": "Your output text" },
                "ext": { "type": "string", "description": "The file extension associated with your text output. Default is 'txt' or 'md' - but could be 'js', 'html' etc if required." }
            },
            "required": ["textOutput", "ext"]
        }} );
    if(call.isErr()){
        return Shared.v2Core.Helpers.Err(`Error (AiTextAction -> Generate Text) : ${call.value}`);
    }
    if (agent && typeof agent.addAiCount === 'function') {
            agent.addAiCount(1);
    }
    let message = new  Shared.aiAgents.Classes.TextMessage({
        role: Shared.aiAgents.Constants.Roles.Tool,  
        textData: call.value.textOutput,
        ext: call.value.ext,
        toolName: "aiTextAction",
        instructions: taskDescription
    });
    return Shared.v2Core.Helpers.Ok([message]);
}

