import { Services } from '../../index.js';
import { TextMessage, ImageMessage, AudioMessage, DataMessage, AiJob, BaseMessage } from '../core/classes.js';
import { Roles } from '../core/constants.js';
import { addAnyDirectData } from './inputParser.js';

// Curated data object
/**
 * 
 * @param {TextMessage | ImageMessage | AudioMessage | DataMessage}  messageObject 
 * @param {number} summaryDataSizeThreshold - max size (chars) before being summerised. Default 500.
 * @param {object} aiOptions - Any settings/ options for AI the ai call(s).
 * @param {AiJob} jobObject - Optional - pass a jobObject to allow counting ai calls.
 * @returns {Result[object]} - { key: [messageId], [messageId] : { ...Message content } }
 */
export async function processMessageForContext( messageObject, summaryDataSizeThreshold = 500, aiOptions = {}, jobObject ) {
  if (!(messageObject instanceof BaseMessage)) {
      return Services.v2Core.Helpers.Err(
      'Error (processMessageForContext) : messageObject must be an instance of BaseMessage or a class that extends it.');
  }

  // Init
  let stringRes
  try {
    stringRes = JSON.stringify(messageObject);
  } catch (error) {
    return Services.v2Core.Helpers.Err(`Error : (processMessageForContext) - Error performing stringify : ${error}`);
  }
  
  const dataSize = stringRes.length ?? 0;
  const returnData = {
        key: messageObject.id,
        [messageObject.id]: { ...messageObject }
    }
  // Only summarize if data size exceeds the threshold
  if (dataSize > summaryDataSizeThreshold) {
    let summary = await shortenLargeValues(messageObject, summaryDataSizeThreshold,  aiOptions = {}) 
    // Returns a shortened version if needed.. if not returns initial value.
    if(summary.isErr()){
        return Services.v2Core.Helpers.Err(`Error (processMessageForContext -> shortenLargeValues) : ${summary.value}`)
    }
    returnData[messageObject.id] = summary.value;
  }
  return Services.v2Core.Helpers.Ok(returnData);
}

async function shortenLargeValues(data, maxSize,  aiOptions = {}, visited = new WeakSet()) {
    // 1. Immediate Primitives
    if (data === null || ["undefined", "boolean", "symbol", "bigint", "function"].includes(typeof data)) {
        return Services.v2Core.Helpers.Ok(data);
    }
    // 2. Prevent Infinite Recursion
    if (typeof data === 'object') {
        if (visited.has(data)) return Services.v2Core.Helpers.Ok("[Circular Reference]");
        visited.add(data);
    }

    // 3. Handle Strings/Numbers
    if (typeof data === 'string' || typeof data === 'number') {
        const strVal = String(data);
        if (strVal.length > maxSize) {
            // Catch Base64 data
            let base64Check = isBase64(data);
            if(base64Check === true ){ 
                return Services.v2Core.Helpers.Ok(`[ Base64 data. Length: ${strVal.length} ]`);
            }
            // Else create summary
            const summary = await createSummary(data,  aiOptions = {});
            return summary.isErr() ? summary : Services.v2Core.Helpers.Ok(summary.value);
        }
        return Services.v2Core.Helpers.Ok(data);
    }

    // 4. Binary Data
    if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
        return data.byteLength > maxSize 
            ? Services.v2Core.Helpers.Ok(`[Large Binary Data: ${data.byteLength} bytes]`) 
            : Services.v2Core.Helpers.Ok(data);
    }

    // 4.5 Handle Dates
    if (data instanceof Date) {
        // Return as ISO string for consistency, or return 'data' to keep it as a Date object
        return Services.v2Core.Helpers.Ok(data.toISOString()); 
    }

    // 5. Recursion (Objects/Arrays)
    if (Array.isArray(data)) {
        // Use Promise.all for speed.
        const results = await Promise.all(data.map(item => shortenLargeValues(item, maxSize, aiOptions = {}, visited)));
        for (const res of results) if (res.isErr()) return res;
        return Services.v2Core.Helpers.Ok(results.map(r => r.value));
    }

    if (typeof data === 'object') {
        const newObject = {};
        for (const [key, value] of Object.entries(data)) {
            const res = await shortenLargeValues(value, maxSize, aiOptions = {}, visited);
            if (res.isErr()) return res;
            newObject[key] = res.value;
        }
        return Services.v2Core.Helpers.Ok(newObject);
    }
    return Services.v2Core.Helpers.Ok(data);
}

export async function createSummary(stringRes, aiOptions = {}){
    // summarise data
    let ai = Services.callAI.aiFactory();
    let dataSummary = await ai.generateText(
        PromptsAndSchemas.summarySysPrompt,
        PromptsAndSchemas.summaryUsrPrompt(stringRes),
        aiOptions
    );
    if(dataSummary.isErr()){ ;
        return Services.v2Core.Helpers.Err(`Error (curateToolData) : ${dataSummary.value}`)
    }
    // handle if object or not
    let summary;
    try {
        // catch arrays and objects
        summary = JSON.parse(dataSummary.value)
    } catch {
        // parse fails - treat as string
        summary = dataSummary.value;
    }
    return Services.v2Core.Helpers.Ok(summary);
}

function isBase64(str) {
    if (typeof str !== 'string' || str.length === 0) return false;

    // This regex looks for:
    // 1. Valid characters from BOTH sets: A-Z, a-z, 0-9, +, /, -, _
    // 2. Optional padding (=) at the end
    // 3. Ensuring the length (minus padding) makes sense
    const base64Regex = /^[A-Za-z0-9+/_-]+={0,2}$/;

    if (!base64Regex.test(str)) return false;

    // Final sanity check: Most Base64 (standard) requires length % 4 === 0.
    // However, URL-safe often strips padding. 
    // If it has padding, the total length MUST be a multiple of 4.
    if (str.includes('=') && str.length % 4 !== 0) {
        return false;
    }
    return true;
}


/**
 * Takes the task and all outputs and formats a suitable response to the user. 
 * Output messages are added to messageHistory
 * Full return messages are outputted. 
 * @param {object} agentObject - the 'this' object for the agent calling the function. (Must be AiJob Class) 
 * @param {string} saveFolder - the folder where outputs should be saved.
 * @returns {Result} - Result - Array of AI messages (text, image, audio data etc..)
 */
export async function finialiseOutput(agentObject, saveFolder){
    if(!saveFolder) saveFolder = 'UserFiles/aiOutputs';
    console.log("Finalising Output...");
    // Create OP Plan -> Process each message (auto adds to messageHistory ) -> add to taskOutput
    if(agentObject == null){ return Services.v2Core.Helpers.Err(`Error (finialiseOutput) : agentObject is missing or null`)}
    // Craft output array (overview)
    let outputOverview = await agentObject.aiCall.generateText(
      PromptsAndSchemas.outputOverview.sys,
      PromptsAndSchemas.outputOverview.usr(
        agentObject.task, 
        agentObject.contextData.getToolContextString(),
        JSON.stringify(agentObject.plan, null, 2)
      ),
      { ...agentObject.aiSettings, structuredOutput: PromptsAndSchemas.outputOverview.schema } 
    ); // { outputPlan: [ {type: Enum, instructions: string, contextKey}... ] }
    if(outputOverview.isErr()){
      agentObject.setFailed();
      agentObject.isRunning = false;
      return Services.v2Core.Helpers.Err(`Error (finialiseOutput -> outputOverview ) : ${outputOverview.value}`)    
    } 

    agentObject.addAiCount(1);
    let outputPlan = outputOverview.value.outputPlan || [];
    if(outputPlan.length == 0){
      return Services.v2Core.Helpers.Err(`Error (finialiseOutput -> outputOverview ) : Returned empty output plan!`); 
    }

    // Process Output Plan
    let opMessages = [];
    for(let i=0; i<outputPlan.length; i++){

      if(outputPlan[i].type === "Text"){
        let txt = await processText(agentObject, outputPlan[i]?.contextKey || null);
        if(txt.isErr()) return txt; // already has Result type
        opMessages.push(txt.value);
      }

      if(outputPlan[i].type === "Image"){
        let img = await processImage(agentObject, outputPlan[i]?.contextKey || null);
        if(img.isErr()) return img; // already has Result type
        opMessages.push(img.value);
      }

      if(outputPlan[i].type === "Audio"){
        let aud = await processAudio(agentObject, outputPlan[i]?.contextKey || null);
        if(aud.isErr()) return aud; // already has Result type
        opMessages.push(aud.value);
      }

      if(outputPlan[i].type === "Data"){
        let dta = await processData(agentObject, outputPlan[i]?.contextKey || null);
        if(dta.isErr()) return dta; // already has Result type
        opMessages.push(dta.value);
      }

      if(outputPlan[i].type === "Save"){
        let check = agentObject.messageHistory.getMessagesById(outputPlan[i]?.contextKey);
        if(check == null){
          return Services.v2Core.Helpers.Err(`Error: (finialiseOutput -> save) - Could not located any data for ${outputPlan[i]?.contextKey}`);
        }
        let save = await Services.aiAgents.AgentHelpers.saveMessageContent(check, saveFolder, null);
        if( save.isErr()){ return save }
        let msg = new TextMessage({
          role: Roles.Agent,
          textData: `Message ${check.id} has been saved to ${saveFolder}`,
        })
        agentObject.messageHistory.addMessage(msg);
        opMessages.push(msg);
      }      
    }
    return Services.v2Core.Helpers.Ok(opMessages);
  }

  /**
   * Helper function for finialiseOutput
   * @param {string} contextKey - Optional - the key for a specific tool output. 
   * @returns {Result[ TextMessage | string]} - Result( Text Message | string )
   */
  async function processText(agentObject, contextKey = null){
    // FORMAT TEXT
    let contextObj = contextKey ? 
        agentObject.contextData.getSingleToolContext(contextKey) :
        agentObject.contextData.getFullContextString()

    let formatCall = await agentObject.aiCall.generateText(
      PromptsAndSchemas.processText.sys,
      PromptsAndSchemas.processText.usr(
        agentObject.task,
        JSON.stringify({ context: contextObj }),
      ),
      { ...agentObject.aiSettings, structuredOutput: PromptsAndSchemas.processText.schema } 
    ); // { output: [enum "Text_Output", "Quote_Text" ], data: string }
    if(formatCall.isErr()){
      return Services.v2Core.Helpers.Err(`Error ( processText ) : ${formatCall.value}`)    
    }
    agentObject.addAiCount(1);

    // Catch AI doesn't return output key
    if(formatCall.value?.output === undefined || formatCall.value?.data === undefined){
        return Services.v2Core.Helpers.Err(`Error: (processText) - AI agent has not returned 'output' and/or 'data' key. Unable to progress.`);
    }
    // Return standard message
    let opText = "";
    if(formatCall.value.output == "Text_Output"){
        opText = formatCall.value.data;
    }
    // Return 'quoted' data from tool
    if(formatCall.value.output == "Quote_Text"){
        let contextObj = contextKey ? 
          agentObject.messageHistory.getMessagesById(contextKey) :
          agentObject.messageHistory.getToolMessagesAsObject();
        let augmentedTextOutput = addAnyDirectData(formatCall.value.data, { context: contextObj }); 
        if(augmentedTextOutput.isErr()){
            return Services.v2Core.Helpers.Err(`Error: (processText) : ${augmentedTextOutput.value}`);
        }
        opText =augmentedTextOutput.value;
    }
    // Full Output
    let msg = new TextMessage({ role: Roles.Agent, textData: opText, mimeType: contextObj?.mime || "text/plain" });
    agentObject.messageHistory.addMessage(msg);
    return Services.v2Core.Helpers.Ok(msg);
  }

  /**
   * Helper function for finialiseOutput
   * @param {string} contextKey - Optional - the key for a specific tool output. 
   * @returns {Result[ ImageMessage | string]} - Result( Image Message | string )
   */
  async function processImage(agentObject, contextKey){
    if(contextKey == null){
      return Services.v2Core.Helpers.Err(`Error: (processImage) - contextKey is missing`);
    }
    let check = agentObject.messageHistory.getMessagesById(contextKey);
    if(check == null){
      return Services.v2Core.Helpers.Err(`Error: (processImage) - Could not located any data for ${contextKey}`);
    }
    // Clone & strip out unnessessary data. 
    let img = structuredClone(check); // clone of the message
    img.role = Roles.Agent;
    let summaryMessage = new ImageMessage({
      role: Roles.Agent,
      base64: `[ Base 64 data removed due to size - Full data can be found in message ${contextKey} ]`,
      url: img.url,
      mimeType: img.mime,
      altText: img.altText,
      instructions: img.instructions,
      toolName: img.toolName
    });
    img.toolName = "";
    img.instructions = "";
    // Push summary message to chat, return full message.
    agentObject.messageHistory.addMessage(summaryMessage);
    return Services.v2Core.Helpers.Ok(img);
  }

  /**
   * Helper function for finialiseOutput
   * @param {string} contextKey - Optional - the key for a specific tool output. 
   * @returns {Result[ AudioMessage | string]} - Result( Audio Message | string )
   */
  async function processAudio(agentObject, contextKey){
    if(contextKey == null){
       return Services.v2Core.Helpers.Err(`Error: (processAudio) - contextKey is missing`);
    }
    let check = agentObject.messageHistory.getMessagesById(contextKey);
    if(check == null){
      return Services.v2Core.Helpers.Err(`Error: (processAudio) - Could not located any data for ${contextKey}`);
    }
    // Clone & strip out unnessessary data. 
    let aud = structuredClone(check); // clone of the message
    aud.role = Roles.Agent;
    let summaryMessage = new AudioMessage(
      {
        role: Roles.Agent,
        mimeType: aud.mime,
        url: aud.url,
        base64: `[ Base 64 data removed due to size - Full data can be found in message ${contextKey} ]`,
        transcript: aud.transcript
      }
    )
    aud.toolName = "";
    aud.instructions = "";
    // Push summary message to chat, return full message.
    agentObject.messageHistory.addMessage(summaryMessage);
    return Services.v2Core.Helpers.Ok(aud);
  }

 /**
   * Helper function for finialiseOutput
   * @param {string} contextKey - Optional - the key for a specific tool output.
   * @returns {Result[ DataMessage | string]} - Result( Data Message | string )
   */
 async function processData(agentObject, contextKey ){ 
  if (contextKey == null) {
    return Services.v2Core.Helpers.Err(`Error: (processData) - contextKey is missing`);
  }

  let check = agentObject.messageHistory.getMessagesById(contextKey);
  if (check == null) {
    return Services.v2Core.Helpers.Err(`Error: (processData) - Could not locate any data for ${contextKey}`);
  }

  // Clone the message
  let dta = structuredClone(check); 
  dta.role = Roles.Agent;

  // Refined Data Handling
  if (dta.data instanceof Uint8Array || dta.data instanceof ArrayBuffer) {
    dta.data = `[ Data object contained binary data - This feature is yet to be implemented ]`;
  } else if (typeof dta.data === "object" && dta.data !== null) {
    // Only stringify if it's an actual object/array, not a string or null
    dta.data = JSON.stringify(dta.data, null, 2);
  } 
  // If dta.data is a string (Markdown etc), it stays as a string.

  // Create the summary for the history
  let summaryMessage = new DataMessage({
    role: Roles.Agent,
    // Ensure we use the correct property name from the source
    mimeType: dta.mime || 'text/markdown', 
    data: `[ Data content removed due to size - Full data can be found in message ${contextKey} ]`,
  });

  // Clean up metadata for the return object
  dta.toolName = dta.toolName || "";
  dta.instructions = dta.instructions || "";

  // Push summary to history
  agentObject.messageHistory.addMessage(summaryMessage);
  return Services.v2Core.Helpers.Ok(dta);
}

  /**
   * Helper function for finialiseOutput to strip out image and audio data from tool outputs and replace with a summary message.
   * @param {object} agentObject - the agent object (Not needed at this time).
   * @param {array} messageArray - an array of messages of Base Message type (TextMessage, ImageMessage, AudioMessage, DataMessage)
   * @returns {Result[array]} - Result( array of processed messages )
   */
export function stripOutAudioAndImageData(messageArray){
  //catch non array or empty array
  if(!Array.isArray(messageArray) || messageArray.length == 0){
    return Services.v2Core.Helpers.Err(`Error: (stripOutAudioAndImageData) - messageArray is not an array or is empty!`);
  }
  let opMessages = structuredClone(messageArray); 
  for(let i=0; i<opMessages.length; i++){
    if(opMessages[i].type === "image" || opMessages[i].type === "audio"){
      opMessages[i].base64 = `[ Base 64 data removed due to size - Full data can be found in message ${messageArray[i].id} ]`;
    }
  }
  return Services.v2Core.Helpers.Ok(opMessages);
}

const PromptsAndSchemas = {
    summarySysPrompt: `You are a specialized data processing engine. 
    Your objective is to perform lossy compression on user-provided data structures by summarizing long text values while strictly maintaining the original schema and metadata
    Structural Integrity: You must return a data object or array with the exact same keys and hierarchy as the input.
    Key Matching: Input keys and output keys must be identical. Do not rename, omit, or add keys.
    When summarizing long strings ensure you prioritize the inclusion of key facts, entities, names, locations, file paths etc.
    If the data is encoded, Base64 or other non-plaintext output (eg Javascirpt or json objects) then return a description of the data eg '[ Encoded data ]' or '[ Javascript Code ] etc.'`,
    summaryUsrPrompt: (inputData) => {
        return `Here is the input data needing summarized. Remember to match the return data structure to the input structure. Aim for 1-2 information dense short paragraphs. ### ${inputData} `
    },
    outputOverview: {
        sys: `Your task is to craft a high-level plan for what information will be returned to the user. This is the final step in an agentic workflow.
You will be provided the user task, and tool data outputs to help you.
 
If the task asks for data or information then your plan should deliver this in the fullest extent possible. You should also aim to complete any other tasks such as requests to save data.
Your output plan will consist of one or more 'messages' which will be delivered together as a final output. 
You have the option of including any of the following message types 
      - Text : Returns a block of text.
      - Image : Returns an image
      - Audio : Returns audio
      - Data : Returns data such as JSON.
      - Save : Saves data to the user's system. 
      
For Image, Audio, Data and Save messages you must provide the associated context key for where to find the data Eg 'MSG_h4d2'. 
A context key can be inlcuded for Text messages however is not always necessary. 
Instructions should be directed at the next AI agent who will process each message. Instructions are not returned to the user.

Example output could be 
[{
  type: Text,
  instructions: Answer the users question using the result of the internet research tool.
  contextKey: 'MSG_h4d2' 
},
{
  type: Image,
  instructions: Adding a helpful graphic to the response to help the user understand.
  contextKey: 'MSG_udm3'
},
{
  type: Save,
  instructions: Save the graphic as the user has requested this and previous tools haven't saved this.
  contextKey: 'MSG_udm3'
},
{
  type: Text,
  instructions: Suggest further research questions, or potential next steps for the user.
  contextKey: null
}
]`,
    usr: (task,  contextData, plan) => {
        return `<task> ${task} </task>
Here is the context data and tool outputs (may be empty) <contextData> ${contextData} </contextData>
Here is the plan which details what has been completed <plan> ${plan} </plan>
Make sure not to save data that has already been saved as part of the plan.`;
    },
    schema: {
    "description": "A schema defining the execution plan for an agent's multi-modal output.",
    "type": "object",
    "properties": {
      "outputPlan": {
        "type": "array",
        "description": "An ordered list of output steps or components.",
        "items": {
          "type": "object",
          "properties": {
            "type": {
              "type": "string",
              "enum": ["Text", "Image", "Audio", "Data", "Save"],
              "description": "The format or action type of the output component."
            },
            "instructions": {
              "type": "string",
              "description": "Concise instructions to help the next AI Agent to include the correct data. This is not for the user!"
            },
            "contextKey": {
              "type": "string",
              "description": "The key relating to any data to be added (optional)."
            }
          },
          "required": ["type", "instructions"],
          "additionalProperties": false
        }
      }
    },
    "required": ["outputPlan"],
    "additionalProperties": false
  }
  },
  processText: {
        sys: `Answer in UK English. Your task is to provide a clean, well formatted and comprehensive final output text. 
You will be provided the user task, and tool data outputs. 
If the task asks for data or information then provide this in the fullest extent possible. 
If the task doesn't ask for data or information then summarise the tasks that were completed. 

You have two options for completing the task:  
Text Output: Use the data provided to craft your own detailed text response. This is best for short answers and relatively simple tasks.  
Quote Text. Use the ‘quote tool’ to directly copy the output from one of the tool listed in the context and provide this as a text answer to the user. You must use {{}} tags to reference the data location in your answer. 
   
Example of how to use {{ }} quotes:  
Context Data = { context: { potato: "Example Quote Data", cheese: ["More info..", "Another bit of info.."] } } 
Your answer = '{{ context.potato }}'  will output ‘Example Quote Data’. 

You can only quote the text DO NOT add string functions like .split() etc. You can combine multiple tags if you want to output multiple chunks of data.`,
    
    usr: (task,  contextData) => {
        return `<task> ${task} </task>
Here is the context data and tool outputs (may be empty) <contextData> ${contextData} </contextData>`;
    },
    schema: {
        "type": "object",
        "description": "An object for returning clean, well formatted text to the user.",
        "properties": {
            "output": {
            "type": "string",
            "enum": ["Text_Output", "Quote_Text"]
            },
            "data": {
            "type": "string"
            }
        },
        "required": ["output", "data"]
      }
  }
}