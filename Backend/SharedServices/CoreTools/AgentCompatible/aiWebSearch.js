/*
    Uses The Hive Plugin Tool Standard
*/
import { Services } from "../../index.js";

export const details = {
    toolName:   "aiWebSearch",
    version:    "2026.0.1",
    creator:    "Botzy Bee",
    overview:   "Use AI to search the internet for information - either a specific website or a general web-search.", 
    guide:      null,  
    inputSchema: {
        "type": "object",
        "properties": {
            "taskDescription": {
            "type": "string",
            "description": "The task description or search term to be used when doing the online search."
            },
            "referenceText": {
            "type": "string",
            "description": "Any reference text which might provide context or help the process."
            },
            "targetURL": {
            "type": "string",
            "format": "uri",
            "description": "A specific website to search if known."
            }
        },
        "required": ["taskDescription"]
        }
    };


/**
 * 
 * @param {Services} Shared - For passing the SharedServices object exported via 'Services' 
 * @param {object}  options
 * @param {string}  options.taskDescription - Mandatory. The task description or search term to be used when doing the online search. 
 * @param {string}  options.referenceText - Optional. Any reference text which might provide context or help the process. 
 * @param {string}  options.targetURL - Optional. A specific website to search if known.
 * @returns {Result( ToolOutput | string)} - Returns a result and either ToolOutput or string depending if Ok or Err.
 */
export async function run( 
    Shared = Services, 
    params = {}
){  
    // Destructure input
    const { taskDescription, referenceText, targetURL } = params;
    // Catch bad params
    if( taskDescription == null ){
        return Shared.Utils.logAndErr(`Error (aiWebSearch) : Params missing or incorrect. Param needed: taskDescription`);
    }
    // Create prompt
    let addText = 'Focus on reliable sources and verify information where possible. Use UK English when responding.';
    if (targetURL != null && targetURL != ""){ 
        addText = `Limit your search to this Site <URL>${targetURL}</URL>. Do not include information from any other source.`
    }
    // Context Handling
    let context = "";
    if(Array.isArray(referenceText)){
        referenceText = referenceText.join(" \n ");
    }
    if(typeof referenceText == "object"){
        referenceText = JSON.stringify(referenceText);
    }
    if( referenceText != null ){ context = `Use this context to help you complete the task <context> ${refText} </context>` }
        let sysText = 
    `You are a tool which searches for information online. Focus on quality and accuracy in completing the task.
    Do NOT add your own thoughts, comments or working notes.`;
    let usrText = `Here are your instructions <task>${taskDescription}</task>. ${addText}. ${context}`;
    let providers = Shared.Constants.AiProviders;
    let allCalls = [
        new Shared.AiCall.AiCall().webSearch(sysText, usrText, { provider: providers.gemini }),
        new Shared.AiCall.AiCall().webSearch(sysText, usrText, { provider: providers.perplexity }),
    ];
    let res = await Promise.all(allCalls);
    if (res[0].isErr()){ return Shared.Utils.Err(`Error (aiWebSearch -> Gemini Search) : ${res[0].value}`)}
    if (res[1].isErr()){ return Shared.Utils.Err(`Error (aiWebSearch -> Perplexity Search) : ${res[1].value}`)}
    let combined = { result: `<Gemini_Result> ${res[0].value} </Gemini_Result> `+
        `<Perplexity_Result> ${res[1].value.searchResult} </Perplexity_Result>`, sources: res[1].value.citations };
    let op = new Shared.Classes.ToolOutput("aiWebSearch", taskDescription, combined);
    console.log("OP :: ", combined);
    return Shared.Utils.Ok(op);
}