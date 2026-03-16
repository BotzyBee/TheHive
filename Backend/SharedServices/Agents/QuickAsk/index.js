import { AiJob } from '../../Classes/aiJob.js';
import { AiCall } from "../../CallAI/index.js";
import { Ok, Err } from '../../Utils/helperFunctions.js';
import { getToolsForTask, getToolDetails } from '../../Database/helpers.js';
import { parserPrompts, buildObject, addAnyDirectData, parseNunjucksTemplate } from '../../CoreTools/inputParser.js';
import { callAgentTool, saveMessageContent } from '../../CoreTools/helperFunctions.js';
import { TextMessage, Roles, ImageMessage, AudioMessage, DataMessage } from '../../Classes/index.js';
import { processMessageForContext } from '../agentUtils.js';
import { quickAskFolder } from '../../constants.js';

/**
 *  Quick Ask Agent - used for direct queries to any of the
 *  models in MODEL_REGISTRY (constants.js)
 *  This agent doesn't plan, loop or check outputs. It acts as simple router to one of the model providers.
 */
export class QuickAskAgent extends AiJob {
    /**@type {AiCall} */
    #aiCall;
  constructor({ task = "", aiSettings = {} } = {}){
    super({aiSettings}) // setup parent class
    this.messageHistory.addMessage(new TextMessage({ role: Roles.User, textData: task}));
    this.#aiCall = new AiCall();
    this.task = task;
    this.agentType = "QuickAsk"; 
  }

  async run(){
    // Starting settings
    if(this.startEpochMs == 0) this.setStartTime();
    this.status.setInProgress();
    this.isRunning = true;
    
    // Handle multiple user / agent messages.
    if(this.messageHistory.getMessageCount() > 1 ){
      const taskCall = await this.#aiCall.generateText(
        PromptsAndSchemas.newTask.sys,
        PromptsAndSchemas.newTask.usr(this.messageHistory.getSimpleUserAgentComms()),
        {...this.aiSettings }
      ); // @returns - Result(string)
      if(taskCall.isErr()){ return Err(`Error (Quick Task Agent -> startTask -> generateText) : ${taskCall.value}`)}
      this.task = taskCall.value;
    }

    // Get tool list
    let tools = await getToolsForTask(this.task, 7);
    if(tools.isErr()){ 
      this.setFailed();
      this.isRunning = false;
      return Err(`Error (Quick Task Agent -> startTask -> getToolsForTask) : ${tools.value}`) 
    }

    // Make call to determine the tool to use. 
    let routingCall = await this.#aiCall.generateText(
      PromptsAndSchemas.routingCall.sys,
      PromptsAndSchemas.routingCall.usr(this.task, JSON.stringify(tools.value)),
      { ...this.aiSettings, structuredOutput: PromptsAndSchemas.routingCall.schema } 
    ); 
    // @returns {Result(object)} - Result ({ nextAction: "no-suitable-tool" | "clarify-task" | "use-tool", toolName: "", message: "" })
    
    if(routingCall.isErr()) {
      this.setFailed();
      this.isRunning = false;
      return Err(`Error (Quick Task Agent -> startTask -> aiCall) : ${routingCall.value}`)
    }
    // catch no-suitable tool Or clarify task
    if(routingCall.value.nextAction == "no-suitable-tool" || 
       routingCall.value.nextAction == "clarify-task"
    ){
      if(routingCall.value.nextAction == "no-suitable-tool"){
        this.status.setFailed()
      } else {
        this.status.setAwaitingUserInput();
      }
      this.isRunning = false;
      let msg = new TextMessage({ 
        role: Roles.Agent, textData: routingCall.value.message});
      this.messageHistory.addMessage(msg);
      this.taskOutput.push(msg);
      return Ok("Agent has messaged the user.");
    }
    // Get tool details
    let toolDetails = await getToolDetails(routingCall.value.toolName);
    if(toolDetails.isErr()){
      return Err(`Error (Quick Task Agent -> startTask -> getToolDetails) : ${toolDetails.value}`)
    };
     
    // Craft input params;
    let summaryContext = { context: this.contextData.getAllToolsContext() }
    let paramsCall = await this.#aiCall.generateText(
      parserPrompts.craftParams.sys,
      parserPrompts.craftParams.usr(
        this.task, 
        JSON.stringify(summaryContext),
        JSON.stringify(toolDetails.value.details.inputSchema) 
      ),
      { ...this.aiSettings, structuredOutput: parserPrompts.craftParams.schema } 
    ); 
    // @returns {Result(array(object))} - Returns { params: [ {key: string, type: string, value: any}, ... ] } 
    if(paramsCall.isErr()) {
      this.setFailed();
      this.isRunning = false;
      return Err(`Error (Quick Task Agent -> startTask -> paramsCall ) : ${paramsCall.value}`)
    }

    // Build params into object (injecting data if needed)
    let fullContext = { context: this.messageHistory.getToolMessagesAsObject()}
    let paramObject = parseNunjucksTemplate(paramsCall.value.params, fullContext );

    if(paramObject.isErr()){ 
      this.setFailed();
      this.isRunning = false;
      return Err(`Error (Quick Task Agent -> startTask -> buildObject ) : ${JSON.stringify(paramObject)}`)
    }

    // Call Tool
    console.log(`Calling ${toolDetails.value.details.toolName} ...`);
    let toolCall = await callAgentTool(
      toolDetails.value.details.toolName,
      toolDetails.value.filePath,
      paramObject.value
    ); // @returns Result( [TextMessage | ImageMessage | AudioMessage | DataMessage] | string )
    if(toolCall.isErr()){
      this.setFailed();
      this.isRunning = false;
      return Err(`Error (Quick Task Agent -> startTask -> toolCall ) : ${toolCall.value}`);    
    }

    // Process messages from tool call
    let newMessageLen = toolCall.value?.length ?? 0;
    for(let i=0; i<newMessageLen; i++){
      // Shorten & add to context
      if(toolCall.value[i].role === Roles.Tool){
        console.log("Processing Tool Message... ");
        let processed = await processMessageForContext(toolCall.value[i], 500, this.aiSettings );
        if(processed.isErr()){
          return Err(`Error : (Quick Task Agent -> startTask -> processMessageForContext ) : ${processed.value}`);   
        }
        // Add data to tool context;
        let k = processed.value.key;
        this.contextData.toolData[`${k}`] = processed.value[`${k}`];
        // Add full data to history
        this.messageHistory.addMessage(toolCall.value[i]);
      } else {
        // handle non-tool messages.
        this.messageHistory.addMessage(toolCall.value[i]);
      }
    }
    
    // Finalise output
    let formattedOP = await this.#finialiseOutput();
    if( formattedOP.isErr()){
      this.setFailed();
      this.isRunning = false;
      return formattedOP; // already has Result Class
    }

    this.taskOutput = formattedOP.value;
    this.setEndTime();
    this.setComplete();
    this.isRunning = false;
    return Ok(this.taskOutput);
  }

  async #finialiseOutput(){
    console.log("Finalising Output...");
    // Create OP Plan -> Process each message (auto adds to messageHistory ) -> add to taskOutput

    // Craft output array (overview)
    let outputOverview = await this.#aiCall.generateText(
      PromptsAndSchemas.outputOverview.sys,
      PromptsAndSchemas.outputOverview.usr(this.task, this.contextData.getToolContextString()),
      { ...this.aiSettings, structuredOutput: PromptsAndSchemas.outputOverview.schema } 
    ); // { outputPlan: [ {type: Enum, instructions: string, contextKey}... ] }
    if(outputOverview.isErr()){
      this.setFailed();
      this.isRunning = false;
      return Err(`Error (Quick Task Agent -> startTask -> outputOverview ) : ${outputOverview.value}`)    
    }   
    let outputPlan = outputOverview.value.outputPlan || [];
    if(outputPlan.length == 0){
      return Err(`Error (Quick Task Agent -> startTask -> outputOverview ) : Returned empty output plan!`); 
    }

    // Process Output Plan
    let opMessages = [];
    for(let i=0; i<outputPlan.length; i++){

      if(outputPlan[i].type === "Text"){
        let txt = await this.#processText(outputPlan[i]?.contextKey || null);
        if(txt.isErr()) return txt; // already has Result type
        opMessages.push(txt.value);
      }

      if(outputPlan[i].type === "Image"){
        let img = await this.#processImage(outputPlan[i]?.contextKey || null);
        if(img.isErr()) return img; // already has Result type
        opMessages.push(img.value);
      }

      if(outputPlan[i].type === "Audio"){
        let aud = await this.#processAudio(outputPlan[i]?.contextKey || null);
        if(aud.isErr()) return aud; // already has Result type
        opMessages.push(aud.value);
      }

      if(outputPlan[i].type === "Data"){
        let dta = await this.#processData(outputPlan[i]?.contextKey || null);
        if(dta.isErr()) return dta; // already has Result type
        opMessages.push(dta.value);
      }

      if(outputPlan[i].type === "Save"){
        let check = this.messageHistory.getMessagesById(outputPlan[i]?.contextKey);
        if(check == null){
          return Err(`Error: (finialiseOutput -> save) - Could not located any data for ${outputPlan[i]?.contextKey}`);
        }
        let save = await saveMessageContent(check, quickAskFolder, null);
        if( save.isErr()){ return save }
        let msg = new TextMessage({
          role: Roles.Agent,
          textData: `Message ${check.id} has been saved to ${quickAskFolder}`,
        })
        this.messageHistory.addMessage(msg);
        opMessages.push(msg);
      }      
    }
    return Ok(opMessages);
  }

  /**
   * 
   * @param {string} contextKey - Optional - the key for a specific tool output. 
   * @returns {Result[ TextMessage | string]} - Result( Text Message | string )
   */
  async #processText(contextKey = null){
    // FORMAT TEXT
    let contextObj = contextKey ? 
        this.contextData.getSingleToolContext(contextKey) :
        this.contextData.getAllToolsContext();

    let formatCall = await this.#aiCall.generateText(
      PromptsAndSchemas.processText.sys,
      PromptsAndSchemas.processText.usr(
        this.task,
        JSON.stringify({ context: contextObj }),
      ),
      { ...this.aiSettings, structuredOutput: PromptsAndSchemas.processText.schema } 
    ); // { output: [enum "Text_Output", "Quote_Text" ], data: string }
    if(formatCall.isErr()){
      return Err(`Error ( #processText ) : ${formatCall.value}`)    
    } 

    // Catch AI doesn't return output key
    if(formatCall.value?.output === undefined || formatCall.value?.data === undefined){
        return Err(`Error: (#processText) - AI agent has not returned 'output' and/or 'data' key. Unable to progress.`);
    }
    // Return standard message
    let opText = "";
    if(formatCall.value.output == "Text_Output"){
        opText = formatCall.value.data;
    }
    // Return 'quoted' data from tool
    if(formatCall.value.output == "Quote_Text"){
        let contextObj = contextKey ? 
          this.messageHistory.getMessagesById(contextKey) :
          this.messageHistory.getToolMessagesAsObject();
        let augmentedTextOutput = addAnyDirectData(formatCall.value.data, { context: contextObj }); 
        if(augmentedTextOutput.isErr()){
            return Err(`Error: #finialiseOutput -> addAnyDirectData 1 : ${augmentedTextOutput.value}`);
        }
        opText =augmentedTextOutput.value;
    }
    // Full Output
    let msg = new TextMessage({ role: Roles.Agent, textData: opText });
    this.messageHistory.addMessage(msg);
    return Ok(msg);
  }

  /**
   * 
   * @param {string} contextKey - Optional - the key for a specific tool output. 
   * @returns {Result[ ImageMessage | string]} - Result( Image Message | string )
   */
  async #processImage(contextKey){
    if(contextKey == null){
      return Err(`Error: (#processImage) - contextKey is missing`);
    }
    let check = this.messageHistory.getMessagesById(contextKey);
    if(check == null){
      return Err(`Error: (#processImage) - Could not located any data for ${contextKey}`);
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
    this.messageHistory.addMessage(summaryMessage);
    return Ok(img);
  }

  /**
   * 
   * @param {string} contextKey - Optional - the key for a specific tool output. 
   * @returns {Result[ AudioMessage | string]} - Result( Audio Message | string )
   */
  async #processAudio(contextKey){
    if(contextKey == null){
       return Err(`Error: (#processAudio) - contextKey is missing`);
    }
    let check = this.messageHistory.getMessagesById(contextKey);
    if(check == null){
      return Err(`Error: (#processAudio) - Could not located any data for ${contextKey}`);
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
    this.messageHistory.addMessage(summaryMessage);
    return Ok(aud);
  }

  /**
   * 
   * @param {string} contextKey - Optional - the key for a specific tool output. 
   * @returns {Result[ DataMessage | string]} - Result( Data Message | string )
   */
  async #processData(contextKey){
    if(contextKey == null){
       return Err(`Error: (#processData) - contextKey is missing`);
    }
    let check = this.messageHistory.getMessagesById(contextKey);
    if(check == null){
      return Err(`Error: (#processData) - Could not located any data for ${contextKey}`);
    }
    // Clone & strip out unnessessary data. 
    let dta = structuredClone(check); // clone of the message
    dta.role = Roles.Agent;
    // Handle Data
    if(typeof dta.data == "object"){
      dta.data = JSON.stringify(dta.data, null, 2);
    } 
    if(dta.data instanceof Uint8Array || dta.data instanceof ArrayBuffer){
      // Binary Data 
      dta.data = `[ Data object contained binary data - This feature is yet to be implimented ]`
    }
    let summaryMessage = new DataMessage(
      {
        role: Roles.Agent,
        mimeType: dta.mime,
        data: `[ Data object removed due to size - Full data can be found in message ${contextKey} ]`
      }
    )
    dta.toolName = "";
    dta.instructions = "";
    // Push summary message to chat, return full message.
    this.messageHistory.addMessage(summaryMessage);
    return Ok(dta);
  }

}

const PromptsAndSchemas = {
  routingCall: {
    sys: `Your job is to review the user provided task and ascertain which tool is the most likely to complete the task. You will be given a list of tools to choose from.
Only one tool will be called - even with a single tool call you can still save the output at the end of the task process. 
You should only select a tool if you are confident that it will achieve the user task. 
To select a tool output  nextAction: “use-tool”, toolName: [the name of the tool to use], and message: [instructions for the tool to follow – based on the user task.]
If there are no tools that can complete the user task then you should output nextAction: “no-suitable-tool” and message: [a suitable, polite, professional and helpful message to the user.]
If you need to clarify the task or sent the user another message then output nextAction: "clarify-task" and message: [a suitable, polite, professional and helpful message to the user.]`,
    usr: (task, tools) => { return `Here is the user task <task> ${task} </task>. Here are the available tools <tools> ${tools} </tools>`},
    schema: {
      "type": "object",
      "properties": {
        "nextAction": {
          "type": "string",
          "enum": [
            "no-suitable-tool",
            "clarify-task",
            "use-tool"
          ],
          "description": "The next logical step for the system to take."
        },
        "toolName": {
          "type": "string",
          "description": "The name of the tool to be invoked, if applicable."
        },
        "message": {
          "type": "string",
          "description": "A descriptive message to the user or a clear task for the tool to follow."
        }
      },
      "required": [
        "nextAction",
        "toolName",
        "message"
      ],
      "additionalProperties": false
    }
  },
  newTask: {
    sys: 'You are the Task Synchronisation Specialist, an expert analyst tasked with distilling the dialogue'+
    'between a User and an AI Agent into a single, precise, and actionable objective. Your goal is to synthesise '+
    'the conversation by prioritising the user’s core intent, integrating any clarifications provided by the agent, '+
    'and reflecting updated constraints or preferences. Rather than simply appending new text, you must refine the'+
    ' mission statement to ensure it is accurate, clear, and free of redundant instructions that have been superseded. '+
    'Focus on capturing specific parameters, such as tone, length, or technical requirements, and explicitly highlight any '+
    '"must-have" elements or "hard nos" to ensure the resulting task definition serves as the definitive source of truth for the project.',
    usr: (messages) => {return `Here is the conversation between user and agent: ${messages}`}
  },
  processText: {
        sys: `Answer in UK English. Your task is to provide a clean, well formatted and comprehensive final output text. 
You will be provided the user task, and tool data outputs. 
If the task asks for data or information then provide this in the fullest extent possible. 
If the task doesn't ask for data or information then summarise the tasks that were completed. 

You have two options for completing the task:  
Text Output: Use the data provided to craft your own detailed text response. This is best for short answers and relatively simple tasks.  
Quote Text. Use the ‘quote tool’ to directly copy the output from one of the tool listed in the context and provide this as a text answer to the user. You must use << >> tags to reference the data location in your answer. 
   
Example of how to use << >> quotes:  
Context Data = { context: { potato: "Example Quote Data", cheese: ["More info..", "Another bit of info.."] } } 
Your answer = '<< context.potato >>'  will output ‘Example Quote Data’. 

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
  instructions: Save the graphic as the user has requested this.
  contextKey: 'MSG_udm3'
},
{
  type: Text,
  instructions: Suggest further research questions, or potential next steps for the user.
  contextKey: null
}
]`,
    usr: (task,  contextData) => {
        return `<task> ${task} </task>
Here is the context data and tool outputs (may be empty) <contextData> ${contextData} </contextData>`;
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
}