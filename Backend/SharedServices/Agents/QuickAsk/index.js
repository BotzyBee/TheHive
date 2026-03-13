import { AiJob } from '../../Classes/aiJob.js';
import { AiCall } from "../../CallAI/index.js";
import { Ok, Err } from '../../Utils/helperFunctions.js';
import { getToolsForTask, getToolDetails } from '../../Database/helpers.js';
import { parserPrompts, buildObject, addAnyDirectData } from '../../CoreTools/inputParser.js';
import { callAgentTool } from '../../CoreTools/helperFunctions.js';
import { quickAskFolder, builtInFilePath } from '../../constants.js';

/**
 *  Quick Ask Agent - used for direct queries to any of the
 *  models in MODEL_REGISTRY (constants.js)
 *  This agent doesn't plan, loop or check outputs. It acts as simple router to one of the model providers.
 */
export class QuickAskAgent extends AiJob {
    /**@type {AiCall} */
    #aiCall;
    #task;
  constructor({ task = "", aiSettings = {}, context = {} } = {}){
    super() // setup parent class
    this.conversationHistory.addUserMessage(task);
    this.aiSettings = aiSettings;
    this.contextData = context;
    this.#aiCall = new AiCall();
    this.#task = task;
  }

  async run(){
    // Starting settings
    if(this.startEpochMs == 0) this.setStartTime();
    this.status.setInProgress();
    this.isRunning = true;
    
    // Handle multiple user / agent messages.
    if(this.conversationHistory.getMessageCount() > 1 ){
      const taskCall = await this.#aiCall.generateText(
        PromptsAndSchemas.newTask.sys,
        PromptsAndSchemas.newTask.usr(this.conversationHistory.getAllMessagesString()),
        {...this.aiSettings }
      ); // @returns - Result(string)
      if(taskCall.isErr()){ return Err(`Error (Quick Task Agent -> startTask -> generateText) : ${taskCall.value}`)}
      this.#task = taskCall.value;
    }

    // Get tool list
    let tools = await getToolsForTask(this.#task, 7);
    if(tools.isErr()){ 
      this.setFailed();
      this.isRunning = false;
      return Err(`Error (Quick Task Agent -> startTask -> getToolsForTask) : ${tools.value}`) 
    }

    // Make call to determine the tool to use. 
    let routingCall = await this.#aiCall.generateText(
      PromptsAndSchemas.routingCall.sys,
      PromptsAndSchemas.routingCall.usr(this.#task, JSON.stringify(tools.value)),
      { ...this.aiSettings, structuredOutput: PromptsAndSchemas.routingCall.schema } 
    ); 
    // @returns {Result(object)} - Result ({ nextAction: "no-suitable-tool" | "clarify-task" | "use-tool", toolName: "", message: "" })
    
    if(routingCall.isErr()) {
      this.setFailed();
      this.isRunning = false;
      return Err(`Error (Quick Task Agent -> startTask -> aiCall) : ${routingCall.value}`)
    }
    // catch no-suitable tool
    if(routingCall.value.nextAction == "no-suitable-tool"){
      this.status.setFailed()
      this.isRunning = false;
      this.conversationHistory.addAgentMessage(routingCall.value.message);
      return Ok("Agent has messaged the user.");
    }
    // catch clarify task
    if(routingCall.value.nextAction == "no-suitable-tool"){
      this.status.setAwaitingUserInput();
      this.isRunning = false;
      this.conversationHistory.addAgentMessage(routingCall.value.message);
      return Ok("Agent has messaged the user.");    
    }

    // Get tool details
    let toolDetails = await getToolDetails(routingCall.value.toolName);
    if(toolDetails.isErr()){
      return Err(`Error (Quick Task Agent -> startTask -> getToolDetails) : ${toolDetails.value}`)
    };
     
    // Craft input params;
    let paramsCall = await this.#aiCall.generateText(
      parserPrompts.craftParams.sys,
      parserPrompts.craftParams.usr(
        this.#task, 
        JSON.stringify({ contextData: this.contextData }),
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

    // Build params into object
    let paramObject = buildObject(paramsCall.value.params);
    if(paramObject?.outcome == "Error"){ // May or may not be result class.
      this.setFailed();
      this.isRunning = false;
      return Err(`Error (Quick Task Agent -> startTask -> buildObject ) : ${paramObject.value}`)
    }
    // Call Tool
    console.log(`Calling ${toolDetails.value.details.toolName} ...`);
    let toolCall = await callAgentTool(
      toolDetails.value.details.toolName,
      toolDetails.value.filePath,
      paramObject
    );
    if(toolCall.isErr()){
      this.setFailed();
      this.isRunning = false;
      return Err(`Error (Quick Task Agent -> startTask -> toolCall ) : ${toolCall.value}`)    
    }

    // Finalise output
     let formatCall = await this.#aiCall.generateText(
      PromptsAndSchemas.finalOutput.sys,
      PromptsAndSchemas.finalOutput.usr(
        this.#task,
        `${toolDetails.value.details.toolName} was used and output a result.`,
        JSON.stringify({ toolData: toolCall.value.data }),
      ),
      { ...this.aiSettings, structuredOutput: PromptsAndSchemas.finalOutput.schema } 
    ); // { output: [enum "Text_Output", "Quote_Text", "Save_Text" ], data: string }
    if(formatCall.isErr()){
      this.setFailed();
      this.isRunning = false;
      return Err(`Error (Quick Task Agent -> startTask -> formatCall ) : ${formatCall.value}`)    
    } 
    let formattedOP = await this.#finialiseOutput(formatCall, { toolData: toolCall.value.data });
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

  async #finialiseOutput(AiCallOutput, context){
    // Catch AI doesn't return output key
    if(AiCallOutput.value?.output === undefined || AiCallOutput.value?.data === undefined){
        return Err(`Error: (#finialiseOutput) - AI agent has not returned 'output' and/or 'data' key. Unable to progress.`);
    }
    // Return standard message
    if(AiCallOutput.value.output == "Text_Output"){
        return Ok(AiCallOutput.value.data);
    }
    // Return 'quoted' data from tool
    if(AiCallOutput.value.output == "Quote_Text"){
        let augmentedTextOutput = addAnyDirectData(AiCallOutput.value.data, context); 
        if(augmentedTextOutput.isErr()){
            return Err(`Error: #finialiseOutput -> addAnyDirectData 1 : ${augmentedTextOutput.value}`);
        }
        return Ok(augmentedTextOutput.value);
    }
    // Save output as file
    if(AiCallOutput.value.output == "Save_Text"){
        // Manage project and non-project tasks
        let augmentedTextOutput = addAnyDirectData(AiCallOutput.value.data, context); 
        if(augmentedTextOutput.isErr()){
            return Err(`#finialiseOutput -> addAnyDirectData 2 : ${augmentedTextOutput.value}`);
        }

        let toolCall = await callAgentTool(
          "writeFile",
          builtInFilePath,
          { relativeFolderPath: quickAskFolder, 
            fileContent: augmentedTextOutput.value, 
            fileNameIncExt: `QuickAsk_${this.id}_Result.txt`
          }
        );
        if(toolCall.isErr()){
          return Err(`Error: #finialiseOutput -> writeFile : ${toolCall.value}`)    
        }     
        return Ok(`Task has been completed and output saved to Task_${this.id}.txt in ${quickAskFolder} folder.`)
    }
    return Err(`Error (finialiseOutput) - AiCallOutput.value.output did not match any of the given options. Value: ${AiCallOutput.value.output}`)
  }
}

const PromptsAndSchemas = {
  routingCall: {
    sys: `Your job is to review the user provided task and ascertain which tool is the most likely to complete the task. You will be given a list of tools to choose from.
Only one tool will be called (note - requests to save the output or result of this job does not need a tool call. This will be handled automatically). 
You should only select a tool if you are confident that it will achieve the user task. 
To select a tool output  nextAction: “use-tool”, toolName: [the name of the tool to use], and message: [instructions for the tool to follow – based on the user task.]
If there are no tools that can complete the user task then you should output nextAction: “no-suitable-tool” and message: [a suitable, polite and helpful message to the user.]
If you need to clarify the task or sent the user another message then output nextAction: "clarify-task" and message: [a suitable, polite and helpful message to the user.]`,
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
  finalOutput: {
        sys: `Answer in UK English. Your task is to provide a clean, well formatted and comprehensive final output result. 
You will be provided the user task, plan of action and tool data outputs. 
If the task asks for data or information then provided this in the fullest extent possible. 
If the task doesn't ask for data or information then summarise the tasks that were completed. 

You have three options for completing the task:  
Text Output: Use the data provided to craft your own detailed text response. This is best for short answers and relatively simple tasks.  
Quote Text. Use the ‘quote tool’ to directly copy the output from one of the tool listed in the context and provide this as a text answer to the user. You must use << >> tags to reference the data location in your answer. 
Save Text. Use the save file tool to save a tool’s output to a file in the user’s working directory. You must use << >> tags to reference the data that you want to save to file or create your own response text to save. If the output has already been saved as part of the plan, then you should avoid creating a duplicate file.      

Example of how to use << >> quotes:  
Context Data = { context: { potato: "Example Quote Data", cheese: ["More info..", "Another bit of info.."] } } 
Your answer = '<< context.potato >>'  will output ‘Example Quote Data’. 

You can only quote the text DO NOT add string functions like .split() etc. You can combine multiple tags if you want to output multiple chunks of data.`,
    
    usr: (task, actions, contextData) => {
        return `<task> ${task} </task>
Here are the actions that have been completed <actions> ${actions} </actions>
Here is the context data and tool outputs (may be empty) <contextData> ${contextData} </contextData>`;
    },
    schema: {
        "type": "object",
        "description": "An object for returning clean, well formatted text to the user.",
        "properties": {
            "output": {
            "type": "string",
            "enum": ["Text_Output", "Quote_Text", "Save_Text"]
            },
            "data": {
            "type": "string"
            }
        },
        "required": ["output", "data"]
    }
    },
}

