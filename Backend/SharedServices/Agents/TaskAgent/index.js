import { ContextTemplate } from "../../Classes/context.js";
import { Roles, Status, TextMessage, AiJob } from "../../Classes/index.js";
import { Services } from "../../index.js";
import { Ok, Err } from "../../Utils/helperFunctions.js";
import { getToolsForTask, getToolDetails } from "../../Database/helpers.js";
import { processMessageForContext, finialiseOutput } from "../agentUtils.js";
import { parserPrompts, parseNunjucksTemplate } from '../../CoreTools/inputParser.js'
import { callAgentTool } from "../../CoreTools/helperFunctions.js";

export const TaskPhases = {
    Plan: "Planning Phase",
    Action: "Action Phase",
    Review: "Review & Respond Phase"
}

// Note the id created here is used throughout the TaskAgent to link input actions with output data. 
export class TaskAction {
    constructor(action, tool) {
        this.id = Services.Utils.generateShortID("ACT");
        /** The action to be completed */
        this.action = action;
        /** The tool to be used */
        this.tool = tool;
        this.complete = false;
        this.attempt = 0;
    }
    addAttempt(){
        this.attempt += 1;
    }
    setComplete(){
        this.complete = true;
    }
}

export class TaskContextTemplate extends ContextTemplate {
    constructor() {
        super(); // setup global & tool data objects.
        this.globalData.isProject = false;
        this.globalData.projectIndexUrl = ""; // relative url where files are located eg. UserFiles/Projects/ProjectName
        this.globalData.workingDirectory = "/UserFiles/aiOutputs"; // relative url 
    }
    addProjectIndexUrl(relativeIndexUrl){ 
        if(typeof relativeIndexUrl === "string" && relativeIndexUrl != ""){
            this.globalData.isProject = true;
            this.globalData.projectIndexUrl = relativeIndexUrl;
        }
    }
    removeProjectIndexUrl(){
        this.globalData.isProject = false;
        this.globalData.projectIndexUrl = ""
    }
    updateWorkingDirectory(relativeUrl){
        if(typeof relativeUrl === "string" && relativeUrl != ""){
            this.globalData.workingDirectory = relativeUrl;
        }
    }
}

export class TaskAgent extends AiJob {
    constructor({ 
            task = "", 
            aiSettings = {}, 
            toolRetryCount = 2,
            maxLoopBuffer = 5,
            summaryDataSizeThreshold = 500
        } = {}){
        super({aiSettings}) // setup parent class
        this.messageHistory.addMessage(new TextMessage({ role: Roles.User, textData: task}));
        this.task = task;
        this.agentType = "TaskAgent"; 

        // Additional Tool Vars
        this.toolRetryCount = toolRetryCount; // how many times to try a tool.
        this.actionReviewID = null; // used to tell review stage what action / data needs reviewed. 

        // Workflow
        this.plan = []; // array of TaskAction class objects
        this.plansNeedApproved = false; // forces user acceptance of plans prior to action. 
        this.planUpdateNeeded = false; // Switches plan action to update the plan.  
        this.nextPhase = TaskPhases.Plan; // for handling next phase of the loop.
        this.phaseMessage = null; // for passing messages / data between phases.
        this.maxLoopBuffer = maxLoopBuffer; // Gives the agent X number of extra loops to ask questions/ attempt fixes etc.
        this.maxLoops = 10; // this is updated when a plan is created.
        this.summaryDataSizeThreshold = summaryDataSizeThreshold; // How many characters before context summarisation
        this.toolOutputData = []; // temp holds tool output prior to review;
    }

    // [][] ---- PLAN MANAGEMENT FUNCTIONS ---- [][]
    
    #getNextAction(){ 
        let actionLen = this.plan.length ?? 0; 
        for(let i=0; i<actionLen; i++){
            if(this.plan[i]?.complete == false){
                return this.plan[i];
            }
        }
        return null;
    }
    #incrimentActionCount(actionID){ 
        const actionToUpdate = this.plan.find(act => act.id === actionID);
        if (actionToUpdate) {
            actionToUpdate.attempt += 1;
        }
    }
    #setActionComplete(actionID){ 
        const actionToUpdate = this.plan.find(act => act.id === actionID);
        if (actionToUpdate) {
            actionToUpdate.complete = true;
        }
    }
    #setActionText(actionID, actionText){ 
        if(actionID && typeof actionText == "string"){
            const actionToUpdate = this.plan.find(act => act.id === actionID);
            if (actionToUpdate) {
                actionToUpdate.action = actionText;
            }
        }
    }
    #fetchAction(actionID){ 
        const action = this.plan.find(act => act.id === actionID);
        if (action) {
            return action;
        }
        return null;     
    }
    #getCompletedActionsSummary() {
        const completed = this.plan.filter(item => item.complete);
        if (!completed.length) return "No prior actions have been completed.";
        return "The following actions have been completed:\n" + 
               completed.map((item, i) => `${i + 1}. ${item.action}`).join('\n');
    }

    /**
     * Generate text using AI - With auto retry.
     * @param {*} systemMessage 
     * @param {*} userMessage 
     * @param {object} [options]
     * @param {string} [options.model]           - Exact model string (optional)
     * @param {string} [options.provider]        - AiProviders value (optional)
     * @param {number} [options.quality]         - AiQuality value (optional)
     * @param {object} [options.structuredOutput]  - If set, returns parsed JSON; (auto-filters structuredOutputs)
     * @param {bool}   [options.randomModel]       - If true a random model fitting the requirements will be chosen.
     * @returns {Result} - Result ( object | string ) - depending if structured OP or not.
     */
    async #generateText(systemMessage, userMessage, options = this.aiSettings){
        let call;
        for (let i = 0; i < this.toolRetryCount; i++) {
            call = await this.aiCall.generateText(systemMessage, userMessage, options); 
            this.addAiCount(1);
            if (call.isOk()) return call; // already has result
        }
        const errorMsg = `Error ( TaskAgent - #generateText ) : ${call.value}`;
        this.errors.push(errorMsg);
        return Err(errorMsg);        
    }

    /**
     * Planning Stage
     * @param {object} options
     * @param {boolean} [options.updatePlan] - if true will trigger plan update.
     * @param {boolean} [options.useTaskPlanGuides ] - if true planning engine will search for relevant guides. 
     */
    async #planningEngine(options = {}) {
        console.log("Starting Planning.");
        const { isUpdate = false, } = options;
        const statusLabel = isUpdate ? "Updating Task Plan..." : "Creating Task Plan...";
        this.status.setCustomStatus(statusLabel);

        // Prepare Context
        const guideText = "" // params.useTaskPlanGuides ? await getToolGuides() : ""; TO DO !!
        const completedActions = isUpdate ? this.#getCompletedActionsSummary() : "No prior actions completed.";
        const oldPlan = isUpdate ? [...this.plan] : [];

        // Step 1 - Generate/Refine Atomic Actions
        const systemPrompt = isUpdate 
            ? `${PromptsAndSchemas.planning.sys}\nIMPORTANT: Do not duplicate completed work. Focus solely on remaining actions.`
            : PromptsAndSchemas.planning.sys;

        const userPrompt = isUpdate
            ? PromptsAndSchemas.planUpdate.usr(
                this.task, 
                completedActions, 
                this.phaseMessage, 
                this.contextData.getFullContextString(), 
                guideText)
            : PromptsAndSchemas.planning.usr(
                this.task, 
                this.contextData.getFullContextString(), 
                guideText);
        
        const actionStep = await this.#generateText(
            systemPrompt,
            userPrompt,
            { structuredOutput: PromptsAndSchemas.planning.schema }
        ) // { status: enum[ok, need info, cant plan], plan: [{action: string},...], failText: string }
        if (actionStep.isErr()) return actionStep;

        const actionResponse = actionStep.value;
        if(actionResponse == undefined){
            return Err(`Error: ( #planningEngine ) : response is missing status key or value.`)
        }
        if (actionResponse.status === 'need info') {
            this.isRunning = false;
            this.status.setAwaitingUserInput();
            let msg = new TextMessage({ role: Roles.Agent, textData: actionResponse.failText })
            this.messageHistory.addMessage(msg);
            this.taskOutput.push(msg);
            return Ok('Agent Needs More Information from the User.');
        }

        if (actionResponse.status === 'cant plan' || actionResponse?.plan.length == 0) {
            this.isRunning = false;
            this.status.setFailed();
            let msg = new TextMessage({ role: Roles.Agent, textData: actionResponse.failText });
            this.messageHistory.addMessage(msg);
            this.taskOutput.push(msg);
            return Ok(`Error (planningEngine) - ${actionResponse.failText}`);
        }

        // Get tools
        let Step1PlanMerged = actionStep.value.plan.map(item => item.action).join('\n') 
        let tools = await getToolsForTask(`${this.task} \n\n ${Step1PlanMerged}`, 12);
        if(tools.isErr()){ 
            return Err(`Error (planningEngine -> getToolsForTask) : ${tools.value}`) 
        } // [{ ToolName: string, ToolDescription: string, Version: string, FilePath: string,  Vector: [] }, ..]
        
        // Add Task Agent Built-in tools 
        tools.value.push({
            ToolName : "rePlanTool", 
            ToolDescription: "This tool forces the agent to re-plan, updating the plan to include tool data or information which was not originally available."+
            "This tool should be used when a tools response could require new or further actions which cannot be anticipated.",
            FilePath: "TA_TOOL"
        },{
            ToolName : "returnToUser", 
            ToolDescription: "This tool returns the data or outcome of this task to the user. Every plan should end with this tool.",
            FilePath: "TA_TOOL"
        });

        // Phase 2: Map Actions to Tools
        const toolsOverview = tools.value;
        const toolUserPrompt = PromptsAndSchemas.planningTools.usr(
            this.task, 
            JSON.stringify(actionResponse.plan), 
            JSON.stringify(toolsOverview),
            isUpdate ? JSON.stringify(oldPlan.filter(p => p.complete)) : ""
        );

        const toolStep = await this.#generateText(
            PromptsAndSchemas.planningTools.sys,
            toolUserPrompt,
            { structuredOutput: PromptsAndSchemas.planningTools.schema }
        ) 
        if (toolStep.isErr()) return toolStep;

        // Finalize and Merge Plan
        const newActions = toolStep.value.plan.map(p => new TaskAction(p.action, p.tool));
        // If updating, keep completed actions and append/replace the rest
        const completedOldActions = oldPlan.filter(p => p.complete);
        this.plan = isUpdate ? [...completedOldActions, ...newActions] : newActions;
        // Set control flow properties
        this.planUpdateNeeded = false;
        if (this.plansNeedApproved) {
            this.status.setAwaitingUserInput();
            this.nextPhase = TaskPhases.Review; // skip to review stage & return to user.
            this.phaseMessage = "Plan requires user approval."; 
        } else {
            this.nextPhase = TaskPhases.Action; // continue to action phase
            this.phaseMessage = "";
        }
        this.maxLoops = this.maxLoopBuffer + this.plan.length;
        return Ok(isUpdate ? "Plan updated" : "Plan successfully created");
    }

    /**
     * Processes tool outputs into a summary & full outputs
     * @param {array} toolOutputArray - Array of aiMessage types 
     * @return {Result} - Result({ summaryObj: summary data object, rawDataMessage: DataMessage (full tool output) })
     */
    async #processToolOutput(toolOutputArray){
        // Process messages from tool call
        let newMessageLen = toolOutputArray.length ?? 0;
        let summary = {};
        const toolNm = toolOutputArray[0].toolName || "";
        for(let i=0; i<newMessageLen; i++){
            // Shorten & add to context
            if(toolOutputArray[i].role === Roles.Tool){
                console.log("Processing Tool Message... ");
                let processed = await processMessageForContext(toolOutputArray[i], this.summaryDataSizeThreshold, this.aiSettings, this );
                if(processed.isErr()){
                    return Err(`Error : ( processToolOutput ) : ${processed.value}`);   
                }
                // Add data to tool context;
                let k = processed.value.key;
                summary[`${k}`] = processed.value[`${k}`];
            } 
        }
        return Ok({summaryObj: summary, rawMessages: toolOutputArray});
    }

    /**
     * Tool calling stage
     */
    async #performNextAction(){ 
        if(this.status == Status.Stopped ){ 
            return Ok("Task Agent is showing stopped status.");
        }
        this.toolOutputData = []
        this.status.setCustomStatus("Performing Tool Action...");
        let nextAction = this.#getNextAction(); // {id: string, action: string, complete: bool, attempt: num, tool: string } 
        // catch null output
        if(nextAction == null){
            this.nextPhase = TaskPhases.Review;
            this.phaseMessage = `The plan has no further actions outstanding.`;
            this.status.setComplete();
            return Ok("All actions complete");
        }
        this.actionReviewID = nextAction.id; // setup for next review 
        // Catch Built-in Tool requests
        if(nextAction.tool == 'rePlanTool'){ 
            this.phaseMessage = `The tool call has triggered a re-plan request. Action: ${nextAction.action}`;
            let rp = await this.#planningEngine({updatePlan: true})
            if(rp.isErr()){
                return rp; // already has result class & error already pushed to .errors
            }
            const msg = new TextMessage(
                { role: Roles.Tool, textData: "Re-planning tool has created an updated plan.", 
                    toolName: "rePlanTool", instructions: this.phaseMessage, metadata: {actionID: nextAction.id }});
            this.toolOutputData.push(msg);
            let processOP = await this.#processToolOutput([msg]);
            if(processOP.isErr()) return processOP; // has result.
            processOP.value.rawMessages.forEach( msg => this.messageHistory.addMessage(msg));
            this.contextData.toolData = {...this.contextData.toolData, ...processOP.value.summaryObj };
            // Next-Phase and phase message handled in updatePlan();
            return Ok("Re-Planning Complete - moving to action phase.");
        }
        if(nextAction.tool == 'returnToUser'){ 
            this.nextPhase = TaskPhases.Review;
            this.phaseMessage = `Final tool - The return to user tool was called. Task: ${JSON.stringify(nextAction)}. 
            Mark this tool as complete - this will trigger return to user actions.`;
            const msg = new TextMessage(
                { role: Roles.Tool, textData: this.phaseMessage, 
                    toolName: "returnToUser", instructions: "Return the output to user.", metadata: {actionID: nextAction.id }});
            this.toolOutputData.push(msg);
            let processOP = await this.#processToolOutput([msg]); 
            this.contextData.toolData = {...this.contextData.toolData, ...processOP.value.summaryObj };
            // Note - we don't need to push OP to messageHistory as this is done by finaliseOutput in review stage.
            if(processOP.isErr()) return processOP; // has result.
            return Ok("Return to user tool was called");
        }

        // Get full tool object for next tool.
        let toolObj = await getToolDetails(nextAction.tool);
        if(toolObj.isErr()){
            this.errors.push(`Error (Task Agent -> getToolDetails) : ${toolObj.value}`);
            return Err(`Error (Task Agent -> getToolDetails) : ${toolObj.value}`)
        };

        // Craft input params AI Calls
        let craftedParams = await this.#generateText(
            parserPrompts.craftParams.sys,
            parserPrompts.craftParams.usr(nextAction.action, this.getAllContextSummaryString(), JSON.stringify(toolObj.value.details.inputSchema)),
            { ...this.aiSettings, structuredOutput: parserPrompts.craftParams.schema }           
        )// @returns {Result(array(object))} - Returns { params: [ {key: string, type: string, value: any}, ... ] }
        if(craftedParams.isErr()){ 
            this.errors.push(`Error (performAction -> craft input params) : ${craftedParams.value}`)
            return Err(`Error (performAction -> craft input params) : ${craftedParams.value}`)
        }

        this.errors.push(`SUM CONTEXT : ${JSON.stringify(this.getAllContextSummaryString(), null, 2)}`);
        this.errors.push(`CRAFTED PARAMS : ${JSON.stringify(craftedParams.value, null, 2)}` )

        // Build params into object (injecting data if needed)
        let fullContext = this.getAllContextRaw();
        let resolvedParams = parseNunjucksTemplate(craftedParams.value.params, fullContext );
        if(resolvedParams.isErr()){ 
        return Err(`Error (performAction -> parseNunjucksTemplate ) : ${JSON.stringify(resolvedParams)}`)
        }

        // Call Tool
        console.log(`Calling ${toolObj.value.details.toolName} ...`);
        let toolCall = await callAgentTool(
            toolObj.value.details.toolName,
            toolObj.value.filePath,
            resolvedParams.value
        ); // @returns Result( [TextMessage | ImageMessage | AudioMessage | DataMessage] | string )
        if(toolCall.isErr()){
        return Err(`Error (performAction -> toolCall ) : ${toolCall.value}`);    
        }

        // Inject actionID as metadata
        toolCall.value.forEach(msg => msg.metadata['actionID'] = nextAction.id );  
        
        // Add finalise & Then move to review stage.
        this.toolOutputData = [...toolCall.value];
        this.phaseMessage = `Tool ${nextAction.tool} has completed and the output is awaiting review.`;
        this.nextPhase = TaskPhases.Review;
        this.addToolCount(1);
        return Ok(`Tool ${nextAction.tool} has completed and the output is awaiting review.`);
    }

    #getOustandingActionCount(){ 
        let outstandingActions = this.plan.filter(item => item.complete === false);
        let count = outstandingActions.length ?? 0;
        return count;
    }

    #getSummaryContextByActionID(actionID){
       return Object.fromEntries(
        Object.entries(this.contextData.toolData).filter(([key, value]) => {
            return value.metadata?.actionID === actionID;
            })
        );
    }

    /**
     * Review Stage
     */
    // Review & Return 
    async #reviewAndReturn(){

        // [][] -- STATUS & USER ACTIONS -- [][]
        let saveFolder = this.contextData.globalData.isProject 
                ? this.contextData.globalData.projectIndexUrl
                : this.contextData.globalData.workingDirectory;

        // Catch Complete, Stopped & all actions complete.
        if(this.status.isStatus(Status.Complete)  || this.status.isStatus(Status.Stopped)){
            console.log("Stopped Or Complete");
            // All context should have been processed at this point.. just output the final message.
            this.isRunning = false; // stop looping.
            if(this.status.taskStatus != Status.Stopped && this.taskOutput == null){ 
                let output = await finialiseOutput(this, saveFolder); 
                if(output.isErr()){ 
                    this.errors.push(`Error: reviewAndReturn -> finialiseOutput : ${output.value}`);
                    return Err(`Error: reviewAndReturn -> finialiseOutput : ${output.value}`);
                }
                this.taskOutput = output.value;
            }
            this.setEndTime();
            return Ok("Stopped or Complete")
        } 
        
        // Catch new message from User 
        if( this.status.isStatus(Status.NewInfoAdded) ){ 
            console.log("Processing message from user...");
            this.status.setCustomStatus("Processing message from user..."); 
            // user message will have been added to message history by jobManager
            let convoHistory = this.messageHistory.getSimpleUserAgentComms();
            let processUserMessage = await this.#generateText(
                    PromptsAndSchemas.reviewUserMsg.sys,
                    PromptsAndSchemas.reviewUserMsg.usr( convoHistory, JSON.stringify(this.plan)),
                    { ...this.aiSettings, structuredOutput: PromptsAndSchemas.reviewUserMsg.schema } 
            );
            if(processUserMessage.isErr()){
                this.errors.push(`Error ( reviewAndReturn 1 ) : ${processUserMessage.value}`);
                return Err(`Error ( reviewAndReturn 1 ) : ${processUserMessage.value}`);     
            }

            // Handle AI bad schema output
            if(processUserMessage.value?.action === undefined ){
                this.errors.push('Error: (reviewAndReturn -> AI Call (catch message from user) ) : Output doesnt contain required keys');
                return Err('Error: (reviewAndReturn -> AI Call (catch message from user) ) : Output doesnt contain required keys');
            }

            // Stop 
            if(processUserMessage.value.action == "stop"){
                this.isRunning = false;
                this.status.setStoppedByUser();
                this.setEndTime();
                this.phaseMessage = "";
                return Ok("Agent stopped by user.");
            }
            // update task & plan 
            if(processUserMessage.value.action == "update task & plan"){
                this.status.setCustomStatus("Re-wording task and updating plan...");
                // Craft new task
                let newTaskWording = await this.#generateText(
                    PromptsAndSchemas.newTaskWording.sys,
                    PromptsAndSchemas.newTaskWording.usr(
                        this.task,
                        processUserMessage.value.instruction
                    ),
                    { ...this.aiSettings } 
                );
                if(newTaskWording.isErr()){
                    this.errors.push(`Error ( reviewAndReturn 2 ) : ${newTaskWording.value}`);
                    return Err(`Error ( reviewAndReturn 2 ) : ${newTaskWording.value}`);     
                }
                this.task = newTaskWording.value;
                // setup re-plan
                this.nextPhase = TaskPhases.Plan;
                this.planUpdateNeeded = true;
                this.phaseMessage = `The plan needs updated following user feedback: ${processUserMessage.value.instruction}`;
                return Ok("The plan needs updated following user feedback. The task has been updated.")
            }
            // update plan only 
            if(processUserMessage.value.action == "update plan only"){
                this.nextPhase = TaskPhases.Plan;
                this.planUpdateNeeded = true;
                this.phaseMessage = `The plan needs updated following user feedback: ${processUserMessage.value.instruction}`;
                return Ok("The plan needs updated following user feedback")
            }
            // approve existing plan 
            if(processUserMessage.value.action == "approve existing plan"){
                this.nextPhase = TaskPhases.Action;
                this.phaseMessage = "";
                Ok("Plan approved, continuing to action phase.");
            }
            // clarify user message 
            if(processUserMessage.value.action == "clarify user message"){
                this.isRunning = false; 
                this.status.setAwaitingUserInput();
                this.nextPhase = TaskPhases.Review;
                let msg = new TextMessage({role: Roles.Agent, textData: `I couldn't process the last user message. ${processUserMessage.value.instruction}` });
                this.messageHistory.addMessage(msg);
                this.taskOutput.push(msg);
                this.phaseMessage = `I couldn't process the last user message. ${processUserMessage.value.instruction}`;
                return Ok("Last user message needs clarification.")
            }
            this.errors.push("Error: reviewAndReturn -> Catch new message from User : User message could not be parsed into a known output.");
            return Err("Error: reviewAndReturn -> Catch new message from User : User message could not be parsed into a known output.")
        }

        // Not complete, but need to alert the user to something or ask them to OK something. 
        if( this.status.isStatus(Status.Failed) || 
            this.status.isStatus(Status.AwaitingUserInput) || 
            this.status.isStatus(Status.MaxLoopsHit)
        ){
            console.log("Failed | Await User | Max Loops... IE Break for now...");
            this.isRunning = false;
            let returnMessage = await this.#generateText(
                PromptsAndSchemas.returnMessage.sys,
                    PromptsAndSchemas.returnMessage.usr(
                        this.phaseMessage,
                        this.messageHistory.getSimpleUserAgentComms(),
                        this.getFullContextString(),
                        JSON.stringify(this.plan)
                    ),
                { ...this.aiSettings } 
            );
            if(returnMessage.isErr()){
                this.errors.push(`Error ( reviewAndReturn -> craft return message ) : ${returnMessage.value}`);
                return Err(`Error ( reviewAndReturn -> craft return message ) : ${returnMessage.value}`);     
            }
            let msg = new TextMessage({role: Roles.Agent, textData: returnMessage.value});
            this.messageHistory.addMessage(msg);
            this.taskOutput.push(msg);
            this.phaseMessage = "";
            return Ok("Agent has crafted message to user.");
        }

        // [][] -- TOOL REVIEW -- [][]
        // custom status & inProgress status handled here
        this.status.setCustomStatus("Reviewing Tool Output...");
        if(this.actionReviewID == null || this.actionReviewID == undefined){
            this.errors.push('Error (reviewAndReturn -> Tool Review) : actionReviewID == null or undefined');
            return Err('Error (reviewAndReturn -> Tool Review) : actionReviewID == null or undefined');
        }
        // get action & tool output needing reviewed 
        let actionObj = this.#fetchAction(this.actionReviewID); 
        let toolOutput =  this.toolOutputData || []; // Array of Messages from last tool call.
        if(actionObj == null ){
            this.errors.push('Error (reviewAndReturn -> Get Action & Tool Objects ) : Action Object returned null');
            return Err('Error (reviewAndReturn -> Get Action & Tool Objects ) : Action Object returned null');
        }
        if(toolOutput.length === 0){
            this.errors.push('Error (reviewAndReturn -> Get Action & Tool Objects ) : Tool Object returned null');
            return Err('Error (reviewAndReturn -> Get Action & Tool Objects ) : Tool Object returned null');
        }
        // Catch already reviewed (toolId is in context) 
        let contextData = this.#getSummaryContextByActionID(this.actionReviewID);// should be null if tool hasn't been reviewed & approved.
        if(contextData != null){
            this.nextPhase = TaskPhases.Action;
            this.phaseMessage = "";
            this.#setActionComplete(this.actionReviewID);
            Ok(`Skipping review - ${this.actionReviewID} has already been reviewed and added to context.`)
        }
        // Catch rePlan tool (skip review and go back to planning).. should never get here in normal circs. 
        if(toolOutput[0].tool == 'rePlanTool'){
            this.nextPhase = TaskPhases.Plan;
            this.planUpdateNeeded = true;
            return Ok("Skipping review to allow Re-Planning");
        }
        // Catch return to user tool (tool to end task) 
        if(toolOutput[0].tool == 'returnToUser'){
            this.status.setComplete();
            this.isRunning = false;
            this.phaseMessage = "";
            this.setEndTime();
            let output =  await finialiseOutput(this, saveFolder);
            if(output.isErr()){ 
                this.errors.push(`Error: reviewAndReturn -> finaliseOutput 2 : ${output.value}`);
                return Err(`Error: reviewAndReturn -> finaliseOutput 2 : ${output.value}`);
            }
            this.taskOutput = output.value;
            this.#setActionComplete(this.actionReviewID);
            return Ok("Return to user tool called. Final output completed.")
        }

        // Process the tool output(s)
        this.status.setCustomStatus("Processing tool output for context");
        let processedToolOp = await this.#processToolOutput(toolOutput); 
        if(processedToolOp.isErr()){ 
            this.errors.push(`Error (reviewAndReturn -> processToolOutput 1) : ${processedToolOp.value}`);
            return Err(`Error (reviewAndReturn -> processToolOutput 1) : ${processedToolOp.value}`);
        }; // Result({ summaryObj: summary data object, rawDataMessage: DataMessage (full tool output) })

        // Check if complete 
        let completeCheck = await this.#generateText(
            PromptsAndSchemas.completeCheck.sys,
            PromptsAndSchemas.completeCheck.usr(
                actionObj.action,
                JSON.stringify(processedToolOp.value.summaryObj),
                this.contextData.getGlobalContextString() 
            ),
            { ...this.aiSettings, structuredOutput: PromptsAndSchemas.completeCheck.schema } 
        ); // Output { status: COMPLETE || INCOMPLETE, feedback: string (optional) }
        if(completeCheck.isErr()){
            this.errors.push(`Error ( reviewAndReturn -> complete check ) : ${completeCheck.value}`);
            return Err(`Error ( reviewAndReturn -> complete check ) : ${completeCheck.value}`);     
        }
        // Catch AI Schema issues 
        if(completeCheck.value?.status == undefined ){
            this.errors.push(`Error (reviewAndReturn -> completeCheck) : status key or data is missing!`);
            return Err(`Error (reviewAndReturn -> completeCheck) : status key or data is missing!`);
        }
        console.log("REVIEW :: "+JSON.stringify(completeCheck, null, 2));
        // Action did not complete 
        if(completeCheck.value.status == "INCOMPLETE"){ 
            const ac = actionObj.attempt + 1; 
            this.#incrimentActionCount(this.actionReviewID);
            // Tool has exceeded the maximum number of attempts
            if(ac >= this.toolRetryCount){
                this.nextPhase = TaskPhases.Plan;
                this.phaseMessage = `Tool: ${actionObj.tool}  ID: ${this.actionReviewID} - Has failed multiple times when attempting to complete the action.`+
                `\n Action: ${actionObj.action}.`+
                `\n Review the plan to consider alternative ways of completing the user task or adjusting the instructions given to the tool.`;
                this.planUpdateNeeded = true;
                return Ok("Action failed after multiple attempts - triggering re-planning.")
            }
            // Tool has not exceeded maximum number of attempts. Trying again with feedback.  
            let fb = completeCheck.value?.feedback ?? "No feedback given!";
            this.#setActionText(this.actionReviewID, `${actionObj.action}. Feedback from last attempt: ${fb}`);
            this.nextPhase = TaskPhases.Action;
            this.phaseMessage = "";
            return Ok("Tool failed to complete the task - trying again!");
        }
        // Action is complete 
        if(completeCheck.value.status == "COMPLETE"){           
            this.phaseMessage = "";
            this.nextPhase = TaskPhases.Action;
            this.toolOutputData = [];
            this.#incrimentActionCount(this.actionReviewID);
            this.#setActionComplete(this.actionReviewID);
            // Push data to context & message history
            processedToolOp.value.rawMessages.forEach( msg => this.messageHistory.addMessage(msg));
            this.contextData.toolData = {...this.contextData.toolData, ...processedToolOp.value.summaryObj };

            // - catch all actions complete 
            // (Only gets here if 'returnToUser' tool isn't added to the plan)
            const newOustandingActionCount = this.#getOustandingActionCount();
            if (newOustandingActionCount === 0) {
                this.status.setComplete();
                this.isRunning = false;
                this.phaseMessage = "";
                this.setEndTime();
                let output = await finialiseOutput(this, saveFolder);
                if(output.isErr()){ 
                    this.errors.push(`Error: reviewAndReturn -> finialiseOutput 3 : ${output.value}`);
                    return Err(`Error: reviewAndReturn -> finialiseOutput 3 : ${output.value}`);
                }
                this.taskOutput = output.value;
                return Ok("All Actions Complete - Review Complete - Task Complete :-)")
            }
            // action complete return -> back to action phase
            return Ok("Review complete - proceed with next action.")
        }
    }

    // [][] --- MAIN ENTRY POINT --- [][]
    
    async run(){
        console.log("Starting Task Agent Job")
        // Start / Re-start the agent
        this.isRunning = true;
        this.taskOutput = []; 
        
        // Main Loop :: Plan -> Act -> Review
        while(this.isRunning == true){
            // PLAN
            if(this.nextPhase == TaskPhases.Plan){
                let plan = await this.#planningEngine({updatePlan : this.updateExistingPlan});
                if(plan.isErr()){ 
                    console.log("ERROR Plan - ", plan.value);
                    this.status.setFailed();
                    this.isRunning = false;
                    return Err(`Error (Run -> plan) : ${plan.value}`);
                }
            }
            
            // ACTION
            if(this.nextPhase == TaskPhases.Action){
                let action = await this.#performNextAction();
                console.log(JSON.stringify(action.value));
                if(action.isErr()){ 
                    console.log("ERROR Action - ", action.value);
                    this.status.setFailed(); // sets isRunning to false
                    return Err(`Error (Run -> action) : ${action.value}`);
                }
            }

            // REVIEW & RESPOND
            if(this.nextPhase == TaskPhases.Review){
                console.log("Reviewing...");
                let review = await this.#reviewAndReturn();
                console.log(JSON.stringify(review.value));
                if(review.isErr()){ 
                    console.log("ERROR Review - ", review.value);
                    this.status.setFailed(); // sets isRunning to false
                    return Err(`Error (Run -> review) : ${review.value}`);
                }
            }

            // catch max loops
            if(this.stats.loopNumber >= this.maxLoops){
                this.status.setMaxLoopsHit()
                this.nextPhase = TaskPhases.Review;
            }
            this.addLoopCount(1);
        }// end main loop
    
    // TEMP - Save output for de-bugging.
    const containerVolumeRoot = Services.Constants.containerVolumeRoot; 
    const targetDirectoryInContainer = Services.Utils.pathHelper.join(containerVolumeRoot, 'UserFiles/TestJobs/');
    await Services.FileSystem.saveFile(targetDirectoryInContainer, JSON.stringify(this, null, 2), `${this.id}.txt`);
    
    return Ok("Task Agent has stopped or completed");
    }
}// end Task Agent


const PromptsAndSchemas = {
    planning: {
        sys: `Role: You are a Logic Decomposition Specialist. Your goal is to transform vague user tasks into a sequence of atomic, "zero-assumption" action points for an autonomous AI agent.
Core Philosophy: You must take nothing for granted. 

If a task contains a relative term (e.g., "yesterday," "last week," "the budget"), you must try and resolve these. Note some details may be found in globalData or toolData.  

Instructions:
1.	Variable Resolution: Identify all relative terms, pronouns, or entities and create steps to resolve them.
2.	Unless specifcally given - any file paths should use the working directory provided in the globalData. 
3.	Dependency Chain: Ensure no step relies on information that hasn't been explicitly "ascertained" or "retrieved" in a previous step.
4.	UK English: Use British spelling and terminology (e.g., "organise", "programme").

Formatting:
If a plan is possible, provide a numbered list of high-level atomic actions.
If the task is logically impossible or fundamentally flawed: Return status: 'cant plan' and failText: [Reason].
If the task is missing critical data: Return status: 'need info' and failText: [Specific Clarification Questions].

Example Transformation: Task: "Email the summary of yesterday's meeting to Sarah."
1.	Establish current date/time to define "yesterday". (if this can be worked out from context then do so!)
2.	Search calendar or mail logs to identify the specific meeting that occurred "yesterday".
3.	Locate the meeting minutes or recording files associated with that specific event. (The working directory or project folder should be used if provided.)
4.	Generate a summary of the identified content.
5.	Search the global address list or contacts to resolve "Sarah" to a specific email address.
6.	Compose and send the email containing the summary to the resolved email address.
`,
        usr: (task, globalContext, guideText) => {
            return `Here is your task from the user <userTask> ${task} </userTask>
            Here is some context which may help (may be blank) <context> ${globalContext} </context>
            Here is some guide text which may help (may be blank) <guide> ${guideText} </guide>`
        },
        schema: {
            "type": "object",
            "description": "Status of the current task, including the execution plan and any failure details.",
            "properties": {
            "status": {
                "type": "string",
                "enum": ["ok", "need info", "cant plan"],
                "description": "The current state of the task request."
            },
            "plan": {
                "type": "array",
                "description": "A list of steps required to complete the task.",
                "items": {
                "type": "object",
                "properties": {
                    "action": {
                    "type": "string",
                    "description": "Description of the step to be taken."
                    }
                },
                "required": ["action"]
                }
            },
            "failText": {
                "type": "string",
                "description": "Explanation of why the plan failed or cannot be completed."
            }
            },
            "required": ["status"]
        }
    },
    planningTools: {
        sys: `Role: You are a Systems Integration Architect. Your task is to take a raw list of atomic actions and map them to a functional execution plan using a specific set of available tools.
Objectives:
1.	Tool Matching: For every action provided, identify the most appropriate tool from the provided Tool Documentation.
2.	Strategic Synthesis: You are permitted to merge actions if a single tool call handles multiple steps (e.g., a "Search and Read" tool) or add "Verification" actions if a tool's output is required to proceed safely.
3.  Unnessessary steps - You are permitted to remove action if they are not explicitly required. You should aim to complete the task in the fewest steps.

Guidelines for Selection:
1.	Minimalism: Do not use three tools when one sophisticated tool suffices. However you can use the same tool more than once if needed. For example if you need complete the same action on multiple items or files.
2.	Prerequisites: If a tool requires a file path or a specific ID, ensure the preceding action/tool combination is capable of providing that data unless the data is available in the context.
3.	Error Handling: If an action cannot be completed by any available tool, you must flag this in your response.
4.	Gap Analysis: If an action has no corresponding tool, do not guess. Return ‘cant plan’ and enter the reason in failText: [reason]. If the task is missing critical data: Return status: 'need info' and failText: [Specific Clarification Questions].

`,
        usr: (task, actions, tools, priorActions, contextData) => {
            return `Here is your task from the user <userTask> ${task} </userTask>
            Here is a list of suggested atomic actions <actions> ${actions} </actions>
            Here is a list of previously completed action which must not be duplicated (may be empty) <completed> ${priorActions} </completed>
            Here is any context from prior tool use <context> ${contextData} </context>
            Here is a list of available tools <tools> ${tools} </tools>`
        },
        schema: {
            "type": "object",
            "description": "Status of the current task, including the execution plan and any failure details.",
            "properties": {
            "status": {
                "type": "string",
                "enum": ["ok", "need info", "cant plan"],
                "description": "The current state of the task request."
            },
            "plan": {
                "type": "array",
                "description": "A list of steps required to complete the task.",
                "items": {
                "type": "object",
                "properties": {
                    "action": {
                    "type": "string",
                    "description": "Description of the step to be taken."
                    },
                    "tool": {
                    "type": "string",
                    "description": "The name of the tool to be used to complete the action"
                    }
                },
                "required": ["action", "tool"]
                }
            },
            "failText": {
                "type": "string",
                "description": "Explanation of why the plan failed or cannot be completed."
            }
            },
            "required": ["status", "plan"]
        }
    },
    planUpdate: { // note - plan update uses the sys and schema from planning!
        usr: (task, completedActions, reviewFeedback, globalContext, guideText) => {
            return `Here is your task from the user <userTask> ${task} </userTask>
            The following actions have already been completed <completed> ${completedActions} </completed>
            Here are any issues that need to be resolved <issues> ${reviewFeedback} </issues>
            Here is some context which may help (may be blank) <context> ${globalContext} </context>
            Here is some guide text which may help (may be blank) <guide> ${guideText} </guide>
            IMPORTANT: Only include the new actions needing to be done in your output. Do not include actions which have already been completed in your plan.`
        },
    },
    craftParams: {
        sys: `
        You are an AI agent tasked with building input parameter objects.
        The final output should always be an array of objects where each object has this shape: { key: string, type: string, value: any }.
        Use the input schema to decide what keys and values you need to add to the array.
        You will also be given an string with context data which will be useful when crafting the parameters.
        Do NOT try to answer the query and do NOT add your own thoughts or comments to the output.

        In the value field you can include data directly or include a reference to the context data via a property access path.
        Any property access paths must be wrapped in << >> and have the type field set to 'ref'.
        Note use an array if you want to combine multiple property access paths - example: [<< path.1 >>, << path.here >>, << another.path >>] .

        Examples of how to use property access paths (if needed):
        contextData: { ACT_XXXX: { tool: "the tool used", action: "what the tool did.", data: { a: "some output data", b: false }} }
        param output = [
            { key : 'key_from_schema' , type: 'ref', value: '<< contextData.ACT_XXXX.data.b >>' },
            { key : 'key_from_schema2' , type: 'ref', value: '<< contextData.ACT_XXXX.data.a >> can be combined in the output.' }
        ]`,
        usr: (task, contextData, toolSchema) => {
            return `<task> ${task} </task>
            Here is the context data (may be empty) <contextData>${contextData}</contextData>
            Here is the tool input parameters schema <tool>${toolSchema}</tool>
            Remember you can use property access paths or direct responses when crafting the input params.
            Check you are providing params for all inputs specified in the schema - do not miss any that are required.
            Your output must be an array of { key: string, type: string, value: any } objects`;
        },
        schema: {
            "type": "object",
            "description": "An object containing a 'params' property, where 'params' is an array of any type",
            "properties": {
                "params": {
                    "type": "array",
                    "items": {
                        "additionalProperties": true,
                        "default": null
                    }
                }
            },
            "required": ["params"]
        },
    },
    reviewUserMsg: {
        sys: `Role and Purpose: You are the Strategic Decision Engine. Your sole purpose is to analyse the dialogue between a User and an AI Agent to determine the optimal next step in their workflow. You act as a precise gatekeeper for the Agent’s task management and planning by reviewing the entire conversation history to understand the trajectory of the project. 

Analysis Protocol 
Intent Inference: Analyse the last User message with high sensitivity. Determine if the user is providing new data, pivoting the core goal, affirming the current path, or expressing confusion. 
Constraint Check: Do not suggest or incorporate new tools unless the User response directly mentions specific tools. 
Logic Gate: If the user provides simple affirmation (e.g., "Thanks," "Go ahead," "Looks good"), do not trigger a change; simply approve the current path. 

Operational Decisions You must choose exactly one of the following paths based on the user's latest input: 
STOP: Use only when the user specifically and explicitly directs the termination of the task (e.g., "Stop," "Cancel," "I'm done"). 
Update Task & Plan: Use when the user’s request fundamentally changes the core objective or the primary scope defined in the first message. 
Update Plan Only: Use when the main goal remains the same, but the user suggests a new method, changes the order of actions, or the current plan is no longer efficient. 
Approve Existing Plan: Use when the user provides affirmative feedback or when the message is a "social" closing that requires no structural changes to the current workflow. 
Clarify User Message: Use only when the user response is blank, nonsensical, or provides directions that do not fit into the other categories. 

Instruction Field Requirements When crafting the text for the ‘instruction’ field, provide a detailed, action-oriented directive for the executing Agent. You must: 
Quote the User: Use direct quotes from the user to anchor your reasoning and ensure accuracy. 
Focus on Delta: Specifically highlight only the changes that are needed rather than restating unchanged parts of the plan. 
Maintain Scope: Ensure the instruction is a direct reflection of the user's intent without adding unauthorized tool suggestions or external assumptions.`,
        usr: (convoHistory, planData) => {
            return `Here is the conversation history between user and AI agent <history> ${convoHistory} </history>
            Here is the current plan (including any completed actions) <plan> ${planData} </plan>`;
        },
        schema: {
        "type": "object",
        "description": "An object used to manage task workflow and updates based on user feedback.",
        "properties": {
            "action": {
            "type": "string",
            "description": "The specific operation to perform.",
            "enum": [
                "stop",
                "update task & plan",
                "update plan only",
                "approve existing plan",
                "clarify user message"
            ]
            },
            "instruction": {
            "type": "string",
            "description": "Detailed guidance on what needs to happen or change based on user feedback. This is only needed if updating the task or plan."
            }
        },
        "required": [
            "action"
        ],
        "additionalProperties": false
        }
    },
    newTaskWording: {
        sys: `Your task is to reword the current task using feedback as a guide. You should keep the task as detailed and clear as possible. Use UK English.`,
        usr: (task, feedback) => { return `Here is the curent task wording <task> ${task} </task>.
        Here is feedback on what needs to change in the task <feedback> ${feedback} </feedback>` },
    },
    returnMessage: {
        sys: `You are a helpful AI Agent. Your task is to draft a comprehensive response to a user based on the context provided. Your goal is to move the project forward without requiring unnecessary back-and-forth. 
        Your communication style is professional, proactive, and polished. 
        The topic or reason you are messaging the user will be detailed in <phaseMessage>. You will be given other context to help you craft a response message.
        Focus on clarity. If sending the action plan for approval - ensure to include the full plan to allow the user to review it. Use UK English. Format and structure your messages for readability.`,
        usr: (phaseMessage, convoHistory, worldContext, plan) => { return `Here is the phaseMessage which details the reason for messaging the user <phaseMessage> ${phaseMessage} </phaseMessage>.
        Here is the conversation history with the user <history> ${convoHistory} </history>
        Here is some context data (may be empty) <context> ${worldContext} </context>
        Here is the task plan. Remember to include this in full if you want the user to review it. <plan> ${plan} </plan>` },
    },
    completeCheck: {
        sys: `Role: You are a pragmatic Quality Assurance (QA) Critic Agent. Your purpose is to verify that the tool output effectively addresses the user's core intent.
Goal: Do not nitpick. Your objective is to ensure the output is useful and accurate, not necessarily perfect.

Evaluation Framework:
Status: COMPLETE: Use this if the output is substantially correct and addresses the primary request, even if there are minor formatting nuances or non-essential omissions.
Status: INCOMPLETE: Use this only if the output fails to answer the core question, contains critical errors that render the information unusable, or is missing essential data required for the task.

Feedback Protocol (For INCOMPLETE status only):
If you mark a tool call as INCOMPLETE, provide a brief Correction Directive:
Critical Gap: Briefly identify the "make-or-break" missing piece of data or the specific error.
Required Fix: Provide a clear, one-sentence instruction for what needs to change to make the result acceptable.

Avoid commenting on style, tone, or non-essential formatting unless it prevents the user from achieving their goal.`,
        usr: (actionText, toolOutputData, globalContext) => { return `Here is the user task which the tool should complete <task> ${actionText} </task>
        Here is the output from the tool call <toolData> ${toolOutputData} </toolData>
        Here is some global context which might help (may be empty) <globalContext> ${globalContext} </globalContext>` },
        schema: {
        "type": "object",
        "description": "Output schema to track completion status and provide optional feedback.",
        "properties": {
            "status": {
            "type": "string",
            "enum": [
                "COMPLETE",
                "INCOMPLETE"
            ],
            "description": "The current completion state of the task."
            },
            "feedback": {
            "type": "string",
            "description": "Optional comments, suggestions, or reasons regarding the task status."
            }
        },
        "required": [
            "status"
        ]
        }
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

// New AI Task Engine - Uses Task Agent to complete tasks. 
// export async function TaskEngine(agent = new TaskAgent()){
//     try {
//         // Start / Re-start the agent
//         agent.isRunning = true;
//         agent.status.setInProgress();
//         agent.taskOutput = null; 

//         // Main Loop :: Plan -> Act -> Review
//         while(agent.isRunning == true){

//             // PLAN
//             if(agent.nextPhase == TaskPhases.Plan){
//                 let plan = await agent.createPlan({updateExistingPlan: agent.updateExistingPlan});
//                 console.log(JSON.stringify(plan));
//                 if(plan.isErr()){ 
//                     agent.status.setFailed(); // sets isRunning to false
//                     writeFile(agent, { 
//                         relativeFolderPath: agent.contextData.globalData.workingDirectory, 
//                         fileContent: JSON.stringify(agent, null, 2),
//                         fileNameIncExt: `TaskAgent_${agent.id}_Failed.json`
//                     });
//                     return Err({
//                         agentObject: agent,
//                         errorText: `Error (TaskEngine -> plan) : ${plan.value}`
//                     });
//                 }
//             }

//             // ACTION
//             if(agent.nextPhase == TaskPhases.Action){
//                 let action = await agent.performNextAction();
//                 console.log(JSON.stringify(action));
//                 if(action.isErr()){ 
//                     agent.status.setFailed(); // sets isRunning to false
//                     writeFile(agent, { 
//                         relativeFolderPath: agent.contextData.globalData.workingDirectory, 
//                         fileContent: JSON.stringify(agent, null, 2),
//                         fileNameIncExt: `TaskAgent_${agent.id}_Failed.json`
//                     });
//                     return Err({
//                         agentObject: agent,
//                         errorText: `Error (TaskEngine -> action) : ${action.value}`
//                     });
//                 }
//             }

//             // REVIEW & RESPOND
//             if(agent.nextPhase == TaskPhases.Review){
//                 let review = await agent.reviewAndReturn();
//                 console.log(JSON.stringify(review));
//                 if(review.isErr()){ 
//                     agent.status.setFailed(); // sets isRunning to false
//                     writeFile(agent, { 
//                         relativeFolderPath: agent.contextData.globalData.workingDirectory, 
//                         fileContent: JSON.stringify(agent, null, 2),
//                         fileNameIncExt: `TaskAgent_${agent.id}_Failed.json`
//                     });
//                     return Err({
//                         agentObject: agent,
//                         errorText: `Error (TaskEngine -> review) : ${review.value}`
//                     });
//                 }
//             }
//             agent.incrementLoopCount();    
//         }// end main loop

//         // Write Job To File
//         writeFile(agent, { 
//             relativeFolderPath: agent.contextData.globalData.workingDirectory, 
//             fileContent: JSON.stringify(agent, null, 2),
//             fileNameIncExt: `TaskAgent_${agent.id}_Complete.json`
//         }); 

//         return Ok(agent)
//     } catch (error) {
//         console.log(`MAJOR ERROR :: Writing agent to file for debugging. Error - ${error}` );
//         agent.errors.push(`MAJOR ERROR :: ${error}`);
//         writeFile(agent, { 
//             relativeFolderPath: agent.contextData.globalData.workingDirectory, 
//             fileContent: JSON.stringify(agent, null, 2),
//             fileNameIncExt: `TaskAgent_${agent.id}_Failed.json`
//         });
//     }
// }
