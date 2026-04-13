/*
    Uses The Hive Plugin Tool Standard
*/
export const details = {
    toolName:   "aiWebSearch",
    version:    "2026.0.3",
    creator:    "Botzy Bee",
    overview:   "Use AI to search the internet for information - either a specific website or a general web-search. "+
    "This tool simply returns the search results. It does not format or extract data from these results. "
    +"You should use other tools to format the output if required.", 
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

function safeEmit(agent, message){
    if(agent && typeof agent.emitUpdateStatus === "function"){
        agent.emitUpdateStatus(message);
    }
}

/**
 * 
 * @param {Services} Shared - For passing the SharedServices object exported via 'Services' 
 * @param {object}  options
 * @param {string}  options.taskDescription - Mandatory. The task description or search term to be used when doing the online search. 
 * @param {string}  options.referenceText - Optional. Any reference text which might provide context or help the process. 
 * @param {string}  options.targetURL - Optional. A specific website to search if known.
 * @returns {Result[[TextMessage | ImageMessage | AudioMessage | DataMessage] | string ] } - Returns a result or string depending if Ok or Err.
 */
export async function run( 
    Shared, 
    params = {},
    agent = {}
){  
    // Destructure input
    let { taskDescription, referenceText, targetURL } = params;
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
    if( referenceText != null ){ context = `Use this context to help you complete the task <context> ${referenceText} </context>` }
        let sysText = 
    `You are a tool which searches for information online. Focus on quality and accuracy in completing the task.
    Do NOT add your own thoughts, comments or working notes.`;
    let usrText = `Here are your instructions <task>${taskDescription}</task>. ${addText}. ${context}`;
    
    safeEmit(agent, `Performing web-search via Gemini and Perplexity - 🐝🔍`);
    let providers = Shared.Constants.AiProviders;
    let allCalls = [
        new Shared.AiCall.AiCall().webSearch(sysText, usrText, { provider: providers.gemini }),
        new Shared.AiCall.AiCall().webSearch(sysText, usrText, { provider: providers.perplexity }),
    ];
    let res = await Promise.all(allCalls);
    if (res[0].isErr()){ return Shared.Utils.Err(`Error (aiWebSearch -> Gemini Search) : ${res[0].value}`)}
    if (res[1].isErr()){ return Shared.Utils.Err(`Error (aiWebSearch -> Perplexity Search) : ${res[1].value}`)}
    
    const GemiProcessed = transformReferences(Shared, res[0].value.text, res[0].value.references);
    const PxltyProcessed = transformReferences(Shared, res[1].value.searchResult, res[1].value.citations);
    const mergedRefs = [...GemiProcessed.references, ...PxltyProcessed.references];
    
    let combined = { result: `Gemini_Result - ${GemiProcessed.text} `+
        `Perplexity Result - ${PxltyProcessed.text}`, sources: mergedRefs };

    let message = new Shared.Classes.DataMessage({
        role: Shared.Classes.Roles.Tool, 
        data: combined,
        toolName: "aiWebSearch",
        instructions: taskDescription
    });
    return Shared.Utils.Ok([message]);
}

/**
 * Transforms index-based references [n] into unique string references.
 * @param {object} Shared - Shared utilities and constants.
 * @param {string} inputText - The text containing [0], [1], etc.
 * @param {string[]} linksArray - Array of URL strings.
 * @returns {object} { text: string, references: object[] }
 */
function transformReferences(Shared, inputText, linksArray) {
  // Map the original URLs to their new unique reference IDs
  // We do this first so we have a lookup table for the text replacement
  const updatedReferences = linksArray.map((url) => {
    return {
      ref: Shared.Utils.generateSimpleRef(4),
      url: url
    };
  });

  // Use regex to find all [number] patterns in the text
  // \d+ matches one or more digits inside literal square brackets
  const updatedText = inputText.replace(/\[(\d+)\]/g, (match, index) => {
    const num = parseInt(index, 10);

    // Check if the index exists in our new reference array
    if (updatedReferences[num]) {
      return `[${updatedReferences[num].ref}]`;
    }

    // If the number in the bracket doesn't have a corresponding link, 
    // we return the original match to avoid breaking the text.
    return match;
  });

  return {
    text: updatedText,
    references: updatedReferences
  };
}