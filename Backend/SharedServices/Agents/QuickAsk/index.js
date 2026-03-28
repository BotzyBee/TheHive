import { AiJob } from '../../Classes/aiJob.js';
import { Ok, Err } from '../../Utils/helperFunctions.js';
import { getToolsOrGuidesForTask, getToolDetails } from '../../Database/helpers.js';
import { parserPrompts, parseNunjucksTemplate } from '../../CoreTools/inputParser.js';
import { callAgentTool } from '../../CoreTools/helperFunctions.js';
import { TextMessage, Roles } from '../../Classes/index.js';
import { processMessageForContext, finialiseOutput } from '../agentUtils.js';
import { Services } from '../../index.js';

/**
 *  Quick Ask Agent - used for direct queries to any of the
 *  models in MODEL_REGISTRY (constants.js)
 *  This agent doesn't plan, loop or check outputs. It acts as simple router to one of the model providers.
 */
export class QuickAskAgent extends AiJob {
  constructor({ task = "", aiSettings = {} } = {}){
    super({aiSettings}) // setup parent class
    this.messageHistory.addMessage(new TextMessage({ role: Roles.User, textData: task}));
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
      const taskCall = await this.aiCall.generateText(
        PromptsAndSchemas.newTask.sys,
        PromptsAndSchemas.newTask.usr(this.messageHistory.getSimpleUserAgentComms()),
        {...this.aiSettings }
      ); // @returns - Result(string)
      if(taskCall.isErr()){
        this.setFailed();
        this.isRunning = false; 
        return Err(`Error (Quick Task Agent -> startTask -> generateText) : ${taskCall.value}`)}
      this.task = taskCall.value;
       this.addAiCount(1);
    }

    // Get tool list
    this.status.setCustomStatus('Determining best tool to use for the task...');
    let tools = await getToolsOrGuidesForTask(this.task, 7, true);
    if(tools.isErr()){ 
      this.setFailed();
      this.isRunning = false;
      return Err(`Error (Quick Task Agent -> startTask -> getToolsOrGuidesForTask) : ${tools.value}`) 
    }

    // Make call to determine the tool to use. 
    let routingCall = await this.aiCall.generateText(
      PromptsAndSchemas.routingCall.sys,
      PromptsAndSchemas.routingCall.usr(this.task, JSON.stringify(tools.value)),
      { ...this.aiSettings, structuredOutput: PromptsAndSchemas.routingCall.schema } 
    ); 
    // @returns {Result(object)} - Result ({ nextAction: "no-suitable-tool" | "clarify-task" | "use-tool", toolName: "", message: "" })
    this.addAiCount(1);

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
      this.setFailed();
      this.isRunning = false;
      return Err(`Error (Quick Task Agent -> startTask -> getToolDetails) : ${toolDetails.value}`)
    };
     
    // Craft input params;
    this.status.setCustomStatus('Crafting input parameters...');
    let paramsCall = await this.aiCall.generateText(
      parserPrompts.craftParams.sys,
      parserPrompts.craftParams.usr(
        this.task, 
        this.getAllContextSummaryString(),
        JSON.stringify(toolDetails.value.details.inputSchema),
        toolDetails.value.details.guide || "no guide provided"
      ),
      { ...this.aiSettings, structuredOutput: parserPrompts.craftParams.schema } 
    ); 
    this.addAiCount(1);

    // @returns {Result(array(object))} - Returns { params: [ {key: string, type: string, value: any}, ... ] } 
    if(paramsCall.isErr()) {
      this.setFailed();
      this.isRunning = false;
      return Err(`Error (Quick Task Agent -> startTask -> paramsCall ) : ${paramsCall.value}`)
    }

    // Build params into object (injecting data if needed)
    let fullContext = this.getAllContextRaw();
    let paramObject = parseNunjucksTemplate(paramsCall.value.params, fullContext );
    if(paramObject.isErr()){ 
      this.setFailed();
      this.isRunning = false;
      return Err(`Error (Quick Task Agent -> startTask -> buildObject ) : ${JSON.stringify(paramObject)}`)
    }

    // Call Tool
    console.log(`Calling ${toolDetails.value.details.toolName} ...`);
    this.status.setCustomStatus(`Calling ${toolDetails.value.details.toolName} ...`);
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
    this.addToolCount(1);

    // Process messages from tool call
    this.status.setCustomStatus(`Processing output to context...`);
    let newMessageLen = toolCall.value?.length ?? 0;
    for(let i=0; i<newMessageLen; i++){
      // Shorten & add to context
      if(toolCall.value[i].role === Roles.Tool){
        console.log("Processing Tool Message... ");
        let processed = await processMessageForContext(toolCall.value[i], 500, this.aiSettings, this );
        if(processed.isErr()){
          this.setFailed();
          this.isRunning = false;
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
    this.status.setCustomStatus('Task Completed - Finalising Output...');
    let formattedOP = await finialiseOutput(this, 'UserFiles/QuickAskOutputs');
    if( formattedOP.isErr()){
      this.setFailed();
      this.isRunning = false;
      return formattedOP; // already has Result Class
    }

    this.taskOutput = formattedOP.value;
    this.setEndTime();
    this.setComplete();
    this.isRunning = false;
    // Write output for debugging.
    const containerVolumeRoot = Services.Constants.containerVolumeRoot; 
    const targetDirectoryInContainer = Services.Utils.pathHelper.join(containerVolumeRoot, 'UserFiles/TestJobs/');
    await Services.FileSystem.saveFile(targetDirectoryInContainer, JSON.stringify(this, null, 2), `${this.id}.txt`);
    return Ok(this.taskOutput);
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
  }
}