import { AiJob } from '../../Classes/aiJob.js';
import { AiCall } from "../../CallAI/index.js";
import { Ok, Err } from '../../Utils/helperFunctions.js';
import { getToolsForTask, getToolDetails } from '../../Database/helpers.js';
import { parserPrompts, buildObject } from '../../CoreTools/inputParser.js';
import { callAgentTool } from '../../CoreTools/helperFunctions.js';


/**
 *  Quick Ask Agent - used for direct queries to any of the models in MODEL_REGISTRY (constants.js)
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
        PromptsAndSchemas.newTask.usr(this.conversationHistory.getAllMessagesString())
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
      { structuredOutput: parserPrompts.craftParams.schema } 
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
    // USE THE TOOL - Get params/ schema
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

    // PROCESS THE OUTPUT?? 

    this.taskOutput = toolCall.value.data;
    this.setEndTime();
    this.setComplete();
    this.isRunning = false;
    return Ok(this.taskOutput);
  }
}

const PromptsAndSchemas = {
  routingCall: {
    sys: `Your job is to review the user provided task and ascertain which tool is the most likely to complete the task. You will be given a list of tools to choose from. Only one tool will be called. You should only select a tool if you are confident that it will achieve the user task. To select a tool output  nextAction: “use-tool”, toolName: [the name of the tool to use], and message: [instructions for the tool to follow – based on the user task.]
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
  }
}

