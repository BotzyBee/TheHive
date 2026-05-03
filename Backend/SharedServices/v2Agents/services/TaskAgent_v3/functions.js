import { Services } from "../../../index.js";
import { TaskFlow, TaskAction } from "./constantsAndClasses.js";
import { TA_PromptsAndSchemas as PromptsAndSchemas } from './prompts.js';

// [][] -- LOADING FUNCTIONS -- [][]
export async function loadingMain(agentObject){
    let preLoad = agentObject.task.toLowerCase().includes("!!pre-load-files");
    if (preLoad) {
        agentObject.emitUpdateStatus(`Loading Files into Context...`);
        // Extract the required file URLS
        const regex = /target:([^\s]+)/g;
        const urls = [];
        let match;
        while ((match = regex.exec(agentObject.task)) !== null) {
            urls.push(match[1]);
        }
        // Load the URLS 
        let loadedContent = [];
        for(let i=0; i<urls.length ?? 0; i++){
            // Get File data
            const root = Services.fileSystem.Constants.containerVolumeRoot 
            const targetURL = Services.aiAgents.ToolHelpers.pathHelper.join(root, urls[i].trim());
            let fileInfo = Services.fileSystem.CRUD.getFileExtensionAndSize(targetURL); // returns : {"extension":"xlsx","sizeBytes":8665,"sizeFormatted":"8.46 KB"}}
            if(fileInfo.isErr()){
                // Flow to healing
                agentObject.setFlowState(TaskFlow.Healing.main);
                agentObject.TaskState.handoverMessage = `The pre-load stage has thown an error. Could not get file extensions : ERROR - ${fileInfo.value}`;
                agentObject.TaskState.handoverData = [];
                agentObject.errors.push(`Error (loadingMain -> getFileExtensionAndSize ) : ${fileInfo.value}`);
                return;  
            }
            // lookup correct read tool
            let strategyToUse = Services.fileSystem.IO.fileRegistry.getByExt(fileInfo.value.extension).strategy;
            if(strategyToUse.read == null){
                // Flow to healing
                agentObject.setFlowState(TaskFlow.Healing.main);
                agentObject.TaskState.handoverMessage = `The pre-load stage has thown an error : No strategy to read ${fileInfo.value.extension} files.`;
                agentObject.TaskState.handoverData = [];
                agentObject.errors.push(`Error (loadingMain -> getByExt ) : No strategy to read ${fileInfo.value.extension} files.`);
                return;  
            }

            // Use the supplied read function;
            let toolCall = await strategyToUse.read(targetURL);
            if(toolCall.isErr()){
                // Flow to healing
                agentObject.setFlowState(TaskFlow.Healing.main);
                agentObject.TaskState.handoverMessage = `The pre-load stage has thown an error : ${toolCall.value})`;
                agentObject.TaskState.handoverData = [];
                agentObject.errors.push(`Error (loadingMain -> strategyToUse.readFN() : ${toolCall.value})`);
                return;  
            }

            let message = new Services.aiAgents.Classes.DataMessage({
                role: Services.aiAgents.Constants.Roles.Tool, 
                ext: fileInfo.value.extension,
                data: toolCall.value,
                toolName: "preLoadTool",
                instructions: `Read the file: ${targetURL}`
            });
            loadedContent.push(message);
        }
        // Push to context
        let processedToolOp = await agentObject.processToolOutput(loadedContent); 
        if(processedToolOp.isErr()){ 
            // Flow to healing
            agentObject.setFlowState(TaskFlow.Healing.main);
            agentObject.TaskState.handoverMessage = "Process Tool Output has thrown an error - consider re-running process tool output action.";
            agentObject.TaskState.handoverData = [];
            agentObject.errors.push(`Error (processToolOutputToContext -> processToolOutput ) : ${processedToolOp.value}`);
            return;  
        }; // Result({ summaryObj: summary data object, rawDataMessage: DataMessage (full tool output) })
    }
    
    // Flow directly to Planning Stage
    agentObject.setFlowState(TaskFlow.Plan.createPlan);
    agentObject.healPrompt = "";
    agentObject.TaskState.handoverData = [];
    return;
}

// [][] -- PLANNING FUNCTIONS -- [][]
export async function createPlan(agentObject){
    // Plan or Re-plan
    const isReplan = agentObject.TaskState.currentFlowState == TaskFlow.Plan.rePlan ? true : false;
    const statusLabel = isReplan ? "Updating Task Plan..." : "Creating Task Plan...";
    agentObject.emitUpdateStatus(statusLabel);
    
    // [][]  ------------------ [][]
    // [][]  -- Fetch Guides -- [][]
    // [][]  ------------------ [][]
    let guideText = ""
    agentObject.emitUpdateStatus("Fetching Guides...");
    let fetchGuides = await agentObject.getSuitableGuides(agentObject.task);
    if( fetchGuides.isOk()) {
        guideText = fetchGuides.value; // best attempt, if fails then no guides are loaded.
    }
    
    // [][]  -------------------------- [][]
    // [][]  -- Generate First Draft -- [][]
    // [][]  -------------------------- [][]    
    const completedActions = isReplan ? agentObject.getCompletedActionsSummary() : "No prior actions completed.";
    const oldPlan = isReplan ? [...agentObject.plan] : [];
    // Step 1 - Generate/Refine Atomic Actions
    if (!agentObject.isRunning) {
        agentObject.setFlowState(TaskFlow.Stopped.Stopped);
        return;
    } 
    agentObject.emitUpdateStatus("Planning step by step...");
    const systemPrompt = isReplan 
        ? `${PromptsAndSchemas.planning.sys}\nIMPORTANT: Do not duplicate completed work. Focus solely on remaining actions.`
        : PromptsAndSchemas.planning.sys;

    const userPrompt = isReplan
        ? PromptsAndSchemas.planUpdate.usr(
            agentObject.task, 
            completedActions, 
            `${agentObject.TaskState.handoverMessage} \n \n Additional info (if any) : ${agentObject.healPrompt}`, 
            agentObject.contextData.getFullContextString(), 
            guideText)
        : PromptsAndSchemas.planning.usr(
            agentObject.task, 
            agentObject.contextData.getFullContextString(), 
            guideText);
    
    const actionStep = await agentObject.generateText(
        systemPrompt,
        userPrompt,
        { ...agentObject.aiSettings, structuredOutput: PromptsAndSchemas.planning.schema }
    ) // { status: enum[ok, need info, cant plan], plan: [{action: string},...], failText: string }
    if (actionStep.isErr()) {
        // Flow to healing
        agentObject.setFlowState(TaskFlow.Healing.main);
        agentObject.TaskState.handoverMessage = "Planning Step 1 - has thrown an error. Consider re-trying planning phase";
        agentObject.TaskState.handoverData = [actionStep.value];
        agentObject.errors.push(actionStep.value);
        return;
    }
    const actionResponse = actionStep.value;
    if(actionResponse == undefined){
        // Flow to healing
        agentObject.setFlowState(TaskFlow.Healing.main);
        agentObject.TaskState.handoverMessage = "Planning Step has thrown an error - Action Response is undefined. Consider re-trying planning phase.";
        agentObject.TaskState.handoverData = [];
        agentObject.errors.push("Planning Step has thrown an error - Action Response is undefined.");
        return;
    }
    if (actionResponse.status === 'need info') {
        // Flow to Message User
        agentObject.setFlowState(TaskFlow.Action.messageUser);
        agentObject.TaskState.handoverMessage = "Task Agent (Planning Phase) is requesting information from the user.";
        agentObject.TaskState.handoverData = [actionResponse.failText];
        return;
    }
    if (actionResponse.status === 'cant plan' || actionResponse?.plan.length == 0) {
        // Flow to Message User
        agentObject.setFlowState(TaskFlow.Action.messageUser);
        agentObject.TaskState.handoverMessage = "Task Agent (Planning Phase) could not complete an action plan.";
        agentObject.TaskState.handoverData = [actionResponse.failText];
        return;
    }

    // [][]  --------------------------- [][]
    // [][]  -- Fetch Available Tools -- [][]
    // [][]  --------------------------- [][]
    agentObject.emitUpdateStatus("Getting available tools... 🛠️🐝");
    if (!agentObject.isRunning) {
        agentObject.setFlowState(TaskFlow.Stopped.Stopped);
        return;
    } 
    let Step1PlanMerged = actionStep.value.plan.map(item => item.action).join('\n') 
    let tools = await Services.database.Helpers.getToolsOrGuidesForTask(`${agentObject.task} \n\n ${Step1PlanMerged}`, 15);
    if(tools.isErr()){
        // Flow to healing
        agentObject.setFlowState(TaskFlow.Healing.main);
        agentObject.TaskState.handoverMessage = "Planning Step 2 - has thrown an error. Consider re-trying planning phase";
        agentObject.TaskState.handoverData = [tools.value];
        agentObject.errors.push(tools.value);
        return;
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

    // [][]  ------------------------------ [][]
    // [][]  -- Mapping Tools To Actions -- [][]
    // [][]  ------------------------------ [][]
    if (!agentObject.isRunning) {
        agentObject.setFlowState(TaskFlow.Stopped.Stopped);
        return;
    } 
    agentObject.emitUpdateStatus("Matching actions to tools...");
    const toolsOverview = tools.value;
    const toolUserPrompt = PromptsAndSchemas.planningTools.usr(
        `${agentObject.task} \n \n Additional info (if any) : ${agentObject.healPrompt}`, 
        JSON.stringify(actionResponse.plan), 
        JSON.stringify(toolsOverview),
        isReplan ? JSON.stringify(oldPlan.filter(p => p.complete)) : "",
        agentObject.getAllContextSummaryString()
    );
    const toolStep = await agentObject.generateText(
        PromptsAndSchemas.planningTools.sys,
        toolUserPrompt,
        { ...agentObject.aiSettings, structuredOutput: PromptsAndSchemas.planningTools.schema }
    ) 
    if (toolStep.isErr()) {
        // Flow to healing
        agentObject.setFlowState(TaskFlow.Healing.main);
        agentObject.TaskState.handoverMessage = "Planning Step 2 - has thrown an error. Consider re-trying planning phase";
        agentObject.TaskState.handoverData = [toolStep.value];
        agentObject.errors.push(tools.value);
        return;
    }
        
    // Finalize and Merge Plan
    const newActions = toolStep.value.plan.map(p => new TaskAction(p.action, p.tool));
    // If updating, keep completed actions and append/replace the rest
    const completedOldActions = oldPlan.filter(p => p.complete);
    agentObject.plan = isReplan ? [...completedOldActions, ...newActions] : newActions;

    // [][]  --------------------------------- [][]
    // [][]  -- Set Control Flow Properties -- [][]
    // [][]  --------------------------------- [][]
    agentObject.healPrompt = "";
    // Check for flags (!!Flag)
    agentObject.plansNeedApproved = agentObject.task.toLowerCase().includes("!!plans-need-approved");
    if (agentObject.plansNeedApproved) {
        // Flow to Message User
        agentObject.setFlowState(TaskFlow.Action.messageUser);
        agentObject.TaskState.handoverMessage = "The user needs to approve the plan before we continue.";
        agentObject.TaskState.handoverData = agentObject.plan; // already is an array.
    } else {
        // Flow to Craft Params / Tool Calling
        agentObject.setFlowState(TaskFlow.Action.callTool);
        agentObject.TaskState.handoverMessage = "Planning step completed - continue to tool calling.";
        agentObject.TaskState.handoverData = [];
    }
    agentObject.maxLoops = (agentObject.maxLoopBuffer + agentObject.plan.length)*3;
    return;
}

export async function performNextAction(agentObject){ 
    if (!agentObject.isRunning) {
        agentObject.setFlowState(TaskFlow.Stopped.Stopped);
        return;
    } 

    agentObject.TaskState.handoverData = []
    agentObject.emitUpdateStatus("Starting next action... 🐝⚙️");
    let nextAction = agentObject.getNextAction(); // {id: string, action: string, complete: bool, attempt: num, tool: string } 
    // catch null output
    if(nextAction == null){
        // Flow to Finalise Output
        agentObject.setFlowState(TaskFlow.Stopped.FinalOutput);
        agentObject.TaskState.handoverMessage = "No actions needing complete - process final output.";
        agentObject.TaskState.handoverData = [];
        return;
    }

    // [][]  -------------------------- [][]
    // [][]  -- Catch built in tools -- [][]
    // [][]  -------------------------- [][]
    if(nextAction.tool == 'rePlanTool'){ 
        // Flow to Re-Planning
        agentObject.setFlowState(TaskFlow.Plan.rePlan);
        agentObject.TaskState.handoverMessage = "Re-Planning triggered by rePlanTool";
        agentObject.TaskState.handoverData = [];
        // Add tool to message history
        const msg = new Services.aiAgents.Classes.TextMessage(
            { role: Services.aiAgents.Constants.Roles.Tool, textData: "Re-planning tool has been called...", 
                toolName: "rePlanTool", instructions: agentObject.phaseMessage, metadata: {actionID: nextAction.id }});
        agentObject.messageHistory.addMessage(msg);
        return;
    }

    if(nextAction.tool == 'returnToUser'){ 
        // Flow to final
        agentObject.setFlowState(TaskFlow.Stopped.FinalOutput);
        agentObject.TaskState.handoverMessage = "Re-Planning triggered by rePlanTool";
        agentObject.TaskState.handoverData = [];
        // Add tool to message history
        let msgText =  'Final tool - The return to user tool was called. '
        +'This tool does not perform any operations, but signals that the agent has completed its task and is ready to return the final output to the user.';
        const msg = new Services.aiAgents.Classes.TextMessage(
            { role: Services.aiAgents.Constants.Roles.Tool, textData: msgText, 
                toolName: "returnToUser", instructions: "Return the output to user.", metadata: {actionID: nextAction.id }});
        agentObject.messageHistory.addMessage(msg);
        return;
    }

    // [][]  ----------------------- [][]
    // [][]  -- Fetch tool object -- [][]
    // [][]  ----------------------- [][]
    if (!agentObject.isRunning) {
        agentObject.setFlowState(TaskFlow.Stopped.Stopped);
        return;
    } 
    let toolObj = await Services.database.Helpers.getToolDetails(nextAction.tool);
    if(toolObj.isErr()){
        // Flow to healing
        agentObject.setFlowState(TaskFlow.Healing.main);
        agentObject.TaskState.handoverMessage = "Fetch Tool Object has thrown an error. Consider re-trying tool-call phase";
        agentObject.TaskState.handoverData = [toolObj.value];
        agentObject.errors.push(toolObj.value);
        return;
    };

    if (!agentObject.isRunning) {
        agentObject.setFlowState(TaskFlow.Stopped.Stopped);
        return;
    } 
    // [][]  ------------------ [][]
    // [][]  -- Craft Params -- [][]
    // [][]  ------------------ [][]
    let craftedParams = await agentObject.generateText(
        `${Services.aiAgents.InputParse.parserPrompts.craftParams.sys} \n \n Additional Info (if any) : ${agentObject.healPrompt}`,
        Services.aiAgents.InputParse.parserPrompts.craftParams.usr(
            nextAction.action, 
            agentObject.getAllContextSummaryString(), 
            JSON.stringify(toolObj.value.details.inputSchema),
            toolObj.value.details.guide || "no guide provided"
        ),
        { ...agentObject.aiSettings, structuredOutput: Services.aiAgents.InputParse.parserPrompts.craftParams.schema }           
    )// @returns {Result(array(object))} - Returns { params: [ {key: string, type: string, value: any}, ... ] }
    if(craftedParams.isErr()){ 
        // Flow to healing
        agentObject.setFlowState(TaskFlow.Healing.main);
        agentObject.TaskState.handoverMessage = "Craft Parameters Action has thrown an error. Consider re-trying tool-call phase";
        agentObject.TaskState.handoverData = [craftedParams.value];
        agentObject.errors.push(craftedParams.value);
        return;
    }
    // Build params into object (injecting data if needed)
    let fullContext = agentObject.getAllContextRaw();
    let resolvedParams = Services.aiAgents.InputParse.parseNunjucksTemplate(craftedParams.value.params, fullContext );
    if(resolvedParams.isErr()){ 
        // Flow to healing
        agentObject.setFlowState(TaskFlow.Healing.main);
        agentObject.TaskState.handoverMessage = "Build Parameter object step has thrown an error. Consider re-trying tool-call phase";
        agentObject.TaskState.handoverData = [resolvedParams.value];
        agentObject.errors.push(resolvedParams.value);
        // save params for debugging/improvement purposes.
        agentObject.debugParams.push({tool: nextAction.tool, paramsCrafted: craftedParams.value.params, paramsResolved: resolvedParams.value, toolInputSchema: toolObj.value.details.inputSchema });
        return;
    }

    // [][]  --------------- [][]
    // [][]  -- Call Tool -- [][]
    // [][]  --------------- [][]
    if (!agentObject.isRunning) {
        agentObject.setFlowState(TaskFlow.Stopped.Stopped);
        return;
    } 
    agentObject.healPrompt = "";
    agentObject.emitUpdateStatus(`Using Tool: ${toolObj.value.details.toolName}`);
    console.log(`Calling tool ${toolObj.value.details.toolName}`);
    let toolCall = await Services.aiAgents.AgentHelpers.callAgentTool(
        toolObj.value.details.toolName,
        toolObj.value.filePath,
        resolvedParams.value,
        agentObject, // give the tool access to agent functions. 
    ); // @returns Result( [TextMessage | ImageMessage | AudioMessage | DataMessage] | string )
    if(toolCall.isErr()){
        // Flow to healing
        agentObject.setFlowState(TaskFlow.Healing.main);
        agentObject.TaskState.handoverMessage = "Tool Calling action has thrown an error. Consider re-running the tool calling phase or re-plan is the tool used is incorrect.";
        agentObject.TaskState.handoverData = [toolCall.value];
        agentObject.errors.push(toolCall.value);
        return;
    }

    // Inject actionID as metadata
    toolCall.value.forEach(msg => msg.metadata['actionID'] = nextAction.id );  
    
    // Flow to Tool Output Review
    agentObject.setFlowState(TaskFlow.Review.toolOutput);
    agentObject.TaskState.handoverMessage = `Tool ${toolObj.value.details.toolName} has completed and it's output is ready for review.`;
    agentObject.TaskState.handoverData = toolCall.value;
    agentObject.addToolCount(1);
    return;
}

export async function messageUser(agentObject){
    // Send Messaage to user
    let hvrMsg = `Message : ${agentObject.TaskState.handoverMessage} . Any other data : ${JSON.stringify(agentObject.TaskState.handoverData)}` 
    let returnMessage = await agentObject.generateText(
        PromptsAndSchemas.returnMessage.sys,
            PromptsAndSchemas.returnMessage.usr(
                `${hvrMsg} \n \n Additional Info (if any) : ${agentObject.healPrompt}`,
                agentObject.messageHistory.getSimpleUserAgentComms(),
                agentObject.getAllContextSummaryString,
                JSON.stringify(agentObject.plan)
            ),
        { ...agentObject.aiSettings } 
    );
    if(returnMessage.isErr()){
        // Flow to healing
        agentObject.setFlowState(TaskFlow.Healing.main);
        agentObject.TaskState.handoverMessage = "Attempt to messaage the user failed. Consider trying again.";
        agentObject.TaskState.handoverData = [returnMessage.value];
        agentObject.errors.push(returnMessage.value); 
        return;
    }
    let msg = new Services.aiAgents.Classes.TextMessage({role: Services.aiAgents.Constants.Roles.Agent, textData: returnMessage.value});
    agentObject.messageHistory.addMessage(msg);
    agentObject.taskOutput.push(msg);
    // Flow to Complete - triggers emit final (task output)
    agentObject.healPrompt = "";
    agentObject.setFlowState(TaskFlow.Stopped.Complete);
    agentObject.TaskState.handoverMessage = "";
    agentObject.TaskState.handoverData = [];
    return;
}

export async function reviewUserMessage(agentObject){
    
    agentObject.emitUpdateStatus("Got your message..."); 
    // user message will have been added to message history by jobManager
    let convoHistory = agentObject.messageHistory.getSimpleUserAgentComms();
    let processUserMessage = await agentObject.generateText(
            `${PromptsAndSchemas.reviewUserMsg.sys} \n \n Additional Info (if any) : ${agentObject.healPrompt}`,
            PromptsAndSchemas.reviewUserMsg.usr( convoHistory, JSON.stringify(agentObject.plan)),
            { ...agentObject.aiSettings, structuredOutput: PromptsAndSchemas.reviewUserMsg.schema } 
    );
    agentObject.healPrompt = "";
    if(processUserMessage.isErr()){
        // Flow to healing
        agentObject.setFlowState(TaskFlow.Healing.main);
        agentObject.TaskState.handoverMessage = "Reviewing User Messaage Failed. Consider trying user message review again.";
        agentObject.TaskState.handoverData = [processUserMessage.value];
        agentObject.errors.push(processUserMessage.value);
        return;       
    }

    // Handle AI bad schema output
    if(processUserMessage.value?.action === undefined ){
        // Flow to healing
        agentObject.setFlowState(TaskFlow.Healing.main);
        agentObject.TaskState.handoverMessage = "Reviewing User Messaage Failed. The output did not follow the schema - action field missing.";
        agentObject.TaskState.handoverData = [];
        agentObject.errors.push("Error (reviewUserMessage) - Reviewing User Messaage Failed. The output did not follow the schema - action field missing.");
        return; 
    }

    // Stop 
    if(processUserMessage.value.action == "stop"){
        // Flow to Stop State
        agentObject.setFlowState(TaskFlow.Stopped.Stopped);
        agentObject.TaskState.handoverMessage = "";
        agentObject.TaskState.handoverData = [];
        return;
    }
    // update task & plan 
    if(processUserMessage.value.action == "update_task_plan"){
        agentObject.emitUpdateStatus("Updating Plan...");

        // Craft new task
        let newTaskWording = await agentObject.generateText(
            PromptsAndSchemas.newTaskWording.sys,
            PromptsAndSchemas.newTaskWording.usr(
                agentObject.task,
                processUserMessage.value.instruction
            ),
            { ...agentObject.aiSettings } 
        );
        if(newTaskWording.isErr()){
            // Flow to healing
            agentObject.setFlowState(TaskFlow.Healing.main);
            agentObject.TaskState.handoverMessage = "Failed when creating new task wording. Consider retrying process user message.";
            agentObject.TaskState.handoverData = [];
            agentObject.errors.push(`Error (reviewUserMessage) - Failed when creating new task wording. ${newTaskWording.value}`);
            return; 
        }
        agentObject.task = newTaskWording.value;
        // Flow to Re-Plan
        agentObject.setFlowState(TaskFlow.Plan.rePlan);
        agentObject.TaskState.handoverMessage = `The plan needs updated following user feedback: ${processUserMessage.value.instruction}`;
        agentObject.TaskState.handoverData = [];
        return;
    }
    // update plan only 
    if(processUserMessage.value.action == "update_task_only"){
        // Flow to Re-Plan
        agentObject.setFlowState(TaskFlow.Plan.rePlan);
        agentObject.TaskState.handoverMessage = `The plan needs updated following user feedback: ${processUserMessage.value.instruction}`;
        agentObject.TaskState.handoverData = [];
        return;
    }
    // approve existing plan 
    if(processUserMessage.value.action == "approve_existing_plan"){
        // Flow to action phase
        agentObject.setFlowState(TaskFlow.Action.callTool);
        agentObject.TaskState.handoverMessage = `The plan needs updated following user feedback: ${processUserMessage.value.instruction}`;
        agentObject.TaskState.handoverData = [];
        return;
    }
    // clarify user message 
    if(processUserMessage.value.action == "clarify_user_message"){
        // Flow to message user
        agentObject.setFlowState(TaskFlow.Action.messageUser);
        agentObject.TaskState.handoverMessage = `I couldn't process the last user message. ${processUserMessage.value.instruction}`;
        agentObject.TaskState.handoverData = [];   
        return;
    }
    // Flow to healing
    agentObject.setFlowState(TaskFlow.Healing.main);
    agentObject.TaskState.handoverMessage = "Error: reviewAndReturn -> Catch new message from User : User message could not be parsed into a known output.";
    agentObject.TaskState.handoverData = [];
    agentObject.errors.push("Error: reviewAndReturn -> Catch new message from User : User message could not be parsed into a known output.");
    return;    
}

export async function reviewToolOutput(agentObject){
    agentObject.healPrompt = "";
    if (!agentObject.isRunning) {
        agentObject.setFlowState(TaskFlow.Stopped.Stopped);
        return;
    } 
    let toolOutput =  agentObject.TaskState.handoverData || []; // Array of Messages from last tool call.
    if(toolOutput.length === 0){
        // Flow to Final Output
        agentObject.setFlowState(TaskFlow.Stopped.FinalOutput);
        agentObject.TaskState.handoverMessage = "";
        agentObject.TaskState.handoverData = [];
        return;
    }
    let toolActionID = toolOutput[0]?.metadata?.actionID || null ;
    if(toolActionID == null){
        // Flow to healing
        agentObject.setFlowState(TaskFlow.Healing.main);
        agentObject.TaskState.handoverMessage = "Error : Review tool output. No ActionID found. Consider re-running action phase or route to final output.";
        agentObject.TaskState.handoverData = [];
        agentObject.errors.push("Error : Review tool output. No ActionID found. Consider re-running action phase");
        return;  
    }

    // Catch rePlan tool (skip review and go back to planning).. should never get here in normal circs. 
    if(toolOutput[0]?.toolName == 'rePlanTool' || toolOutput == []){
        // Flow to Planning 
        agentObject.setFlowState(TaskFlow.Plan.createPlan);
        agentObject.TaskState.handoverMessage = "";
        agentObject.TaskState.handoverData = [];
        agentObject.setActionComplete(toolActionID); // mark complete so it's included in 'old plan' and merged with new plan.
        return;
    }
    // Catch return to user tool (tool to end task) 
    if(toolOutput[0].toolName == 'returnToUser'){
        // Flow to final
        agentObject.setFlowState(TaskFlow.Stopped.FinalOutput);
        agentObject.TaskState.handoverMessage = "";
        agentObject.TaskState.handoverData = [];
        return;
    }

    agentObject.emitUpdateStatus("Reviewing Tool Output... 🕵️🐝");
    // custom status & inProgress status handled here
    
    // get action & tool output needing reviewed 
    let actionObj = agentObject.fetchAction(toolActionID); // get the action from the plan
    if(actionObj == null ){
        // Flow to healing
        agentObject.setFlowState(TaskFlow.Healing.main);
        agentObject.TaskState.handoverMessage = "Error : Review phase - actionObject returned null - consider re-running planning phase.";
        agentObject.TaskState.handoverData = [];
        agentObject.errors.push("Error (reviewAndReturn -> Get Action & Tool Objects ) : Action Object returned null");
        return;  
    }

    // Catch already reviewed (toolId is in context) 
    let contextData = agentObject.getSummaryContextByActionID(toolActionID);// should be null if tool hasn't been reviewed & approved.
    if(contextData != null && Object.keys(contextData).length > 0){
        agentObject.setActionComplete(toolActionID);
        // Flow to Action
        agentObject.setFlowState(TaskFlow.Action.callTool);
        agentObject.TaskState.handoverMessage = "";
        agentObject.TaskState.handoverData = [];
        return;
    }

    let processedToolMessages = Services.aiAgents.AgentSharedServices.stripOutAudioAndImageData(toolOutput);
    if(processedToolMessages.isErr()){
        // Flow to healing
        agentObject.setFlowState(TaskFlow.Healing.main);
        agentObject.TaskState.handoverMessage = "Error : Review phase - Process Tool Messages Failed. Consider re-running review stage.";
        agentObject.TaskState.handoverData = [];
        agentObject.errors.push(`Error (reviewAndReturn -> stripOutAudioAndImageData ) : ${processedToolMessages.value}`);
        return;  
    }

    // Switch system prompt if the tool doesn't need review (skip review list)
    let sysMessage; 
    if(agentObject.skipReviewTools.includes(toolOutput[0].toolName)){
        sysMessage = PromptsAndSchemas.completeCheck.sysAlt;
    } else {
        sysMessage = PromptsAndSchemas.completeCheck.sys;
    }
    // Check if complete
    let completeCheck = await agentObject.generateText(
        sysMessage,
        PromptsAndSchemas.completeCheck.usr(
            actionObj.action,
            JSON.stringify(processedToolMessages.value), // tool output with audio and image data stripped out.
            agentObject.contextData.getGlobalContextString(),
            JSON.stringify(agentObject.plan)
        ),
        { ...agentObject.aiSettings, structuredOutput: PromptsAndSchemas.completeCheck.schema } 
    ); // Output { status: COMPLETE || INCOMPLETE, replan: true | false, feedback: string (optional) }
    if(completeCheck.isErr()){
        // Flow to healing
        agentObject.setFlowState(TaskFlow.Healing.main);
        agentObject.TaskState.handoverMessage = "Error : Review phase - Tool review call has failed. Consider re-calling review stage.";
        agentObject.TaskState.handoverData = [];
        agentObject.errors.push(`Error (reviewAndReturn -> generateText ) : ${completeCheck.value}`);
        return;  
    }
    // Catch AI Schema issues 
    if(completeCheck.value?.status == undefined ){
        // Flow to healing
        agentObject.setFlowState(TaskFlow.Healing.main);
        agentObject.TaskState.handoverMessage = "Error : Review phase - Tool review call has failed. Consider re-calling review stage.";
        agentObject.TaskState.handoverData = [];
        agentObject.errors.push(`Error (reviewAndReturn -> generateText (Schema Fail!) ) : status value is undefined.}`);
        return;  
    }
    console.log("REVIEW :: "+JSON.stringify(completeCheck.value.status, null, 2));
    console.log("Replan: ", completeCheck.value.replan);
    console.log("Feedback: ", completeCheck.value?.feedback);
    // Action did not complete 
    let fb = completeCheck.value?.feedback ?? "No feedback given!";
    if(completeCheck.value.status == "INCOMPLETE"){ 
        const ac = actionObj.attempt + 1; 
        agentObject.incrimentActionCount(toolActionID);
        // plan needs updated
        if(completeCheck.value.replan === true || completeCheck.value.replan === "true"){
            // Flow to Replan
            agentObject.setFlowState(TaskFlow.Plan.rePlan);
            agentObject.TaskState.handoverMessage = `The Review phase has been completed and signaled that the plan needs updated. Feedback: ${fb}`;
            agentObject.TaskState.handoverData = [];
            return;
        }
        // Tool has exceeded the maximum number of attempts
        if(ac >= agentObject.toolRetryCount){
            // Flow to Re-Plan
            agentObject.setFlowState(TaskFlow.Plan.rePlan);
            agentObject.TaskState.handoverMessage = `Tool: ${actionObj.tool}  ID: ${toolActionID} - Has failed multiple times when attempting to complete the action.`+
            `\n Action: ${actionObj.action}.`+
            `\n Review the plan to consider alternative ways of completing the user task or adjusting the instructions given to the tool.`;
            agentObject.TaskState.handoverData = [];
            return;
        }
        // Tool has not exceeded maximum number of attempts. Trying again with feedback.  
        agentObject.setActionText(toolActionID, `${actionObj.action}. Feedback from last attempt: ${fb}`);
        agentObject.setFlowState(TaskFlow.Plan.rePlan);
        agentObject.TaskState.handoverMessage = "";
        agentObject.TaskState.handoverData = [];
        return;
    }
    // Action is complete - PROCESS TO CONTEXT 
    if(completeCheck.value.status == "COMPLETE"){   
        // Process the tool output(s)
        agentObject.emitUpdateStatus("Adding tool output to context...");
        const reviewData = completeCheck.value; //  { status: COMPLETE || INCOMPLETE, replan: true | false, feedback: string (optional) }
        let processedToolOp = await agentObject.processToolOutput(toolOutput); 
        if(processedToolOp.isErr()){ 
            // Flow to healing
            agentObject.setFlowState(TaskFlow.Healing.main);
            agentObject.TaskState.handoverMessage = "Process Tool Output has thrown an error - consider re-running process tool output action.";
            agentObject.TaskState.handoverData = [];
            agentObject.errors.push(`Error (processToolOutputToContext -> processToolOutput ) : ${processedToolOp.value}`);
            return;  
        }; // Result({ summaryObj: summary data object, rawDataMessage: DataMessage (full tool output) })
        
        let toolActionID = agentObject.TaskState.handoverData[0]?.metadata?.actionID || null ;

        agentObject.incrimentActionCount(toolActionID);
        agentObject.setActionComplete(toolActionID);
        // Push data to context & message history
        processedToolOp.value.rawMessages.forEach( msg => agentObject.messageHistory.addMessage(msg));
        agentObject.contextData.toolData = {...agentObject.contextData.toolData, ...processedToolOp.value.summaryObj };

        // Complete but replan suggested
        if(reviewData.replan  === true || reviewData.replan  === "true"){
            // Flow to replan
            agentObject.setFlowState(TaskFlow.Plan.rePlan);
            agentObject.TaskState.handoverMessage = `The Review phase has been completed and signaled that the plan needs updated. Feedback: ${reviewData.feedback}`;
            agentObject.TaskState.handoverData = [];
            return;            
        }

        // - catch all actions complete 
        // (Only gets here if 'returnToUser' tool isn't added to the plan)
        const newOustandingActionCount = agentObject.getOustandingActionCount();
        if (newOustandingActionCount === 0) {
            // Flow to final output
            agentObject.setFlowState(TaskFlow.Stopped.FinalOutput);
            agentObject.TaskState.handoverMessage = "";
            agentObject.TaskState.handoverData = [];
            return;
        }
        // Flow back to tool calling
        agentObject.setFlowState(TaskFlow.Action.callTool);
        agentObject.TaskState.handoverMessage = "";
        agentObject.TaskState.handoverData = [];
        return;   
    }
}

export async function processFinalOutput(agentObject){
    agentObject.healPrompt = "";
    let saveFolder = agentObject.contextData.globalData.isProject 
        ? agentObject.contextData.globalData.projectIndexUrl
        : agentObject.contextData.globalData.workingDirectory;
    let output =  await Services.aiAgents.AgentSharedServices.finialiseOutput(agentObject, saveFolder); // Finalises from context 
    if(output.isErr()){ 
        // Flow to healing
        agentObject.setFlowState(TaskFlow.Healing.main);
        agentObject.TaskState.handoverMessage = "Process Final Output has thrown an error. Consider re-running final output processing.";
        agentObject.TaskState.handoverData = [];
        agentObject.errors.push(`Error (processFinalOutput -> finialiseOutput ) : ${output.value}`);
        return;          
    }
    agentObject.taskOutput = output.value;
    agentObject.setFlowState(TaskFlow.Stopped.Complete);
}

export async function healing(agentObject){
    agentObject.emitUpdateStatus("Entering healing phase... 🩹🐝");
    let history = agentObject.TaskState.stateHistory;
    let multiFail = hasFailedMultipleTimes(history);
    if(multiFail){
        // Flow to failed. 
        agentObject.emitUpdateStatus("Healing has failed ☹️")
        agentObject.setFlowState(TaskFlow.Stopped.Failed);
        agentObject.TaskState.handoverMessage = "Healing process has failed.";
        agentObject.TaskState.handoverData = [];
        return;
    }

    console.log(`Error details: ${agentObject.TaskState.handoverMessage} . Futher Data (if any): ${JSON.stringify(agentObject.TaskState.handoverData)}`)

    // Consider the best option for healing the error 
    const nextStep = await agentObject.generateText(
        PromptsAndSchemas.healError.sys,
        PromptsAndSchemas.healError.usr(
            `Error details: ${agentObject.TaskState.handoverMessage} . Futher Data (if any): ${JSON.stringify(agentObject.TaskState.handoverData)}`,
            JSON.stringify(agentObject.plan),
            agentObject.task
        ),
        { ...agentObject.aiSettings, structuredOutput: PromptsAndSchemas.healError.schema, quality: 3 } 
    ) // { nextPhase: string, additionalPrompt: string}
    if(nextStep.isErr()){
        console.log("Heal call failed to return any data");
        agentObject.setFlowState(TaskFlow.Stopped.Failed);
        return;
    }
    console.log("Healing output:: ", nextStep.value);
    // Set Flow Control 
    agentObject.TaskState.handoverData = [];
    agentObject.TaskState.handoverMessage = "";
    agentObject.healPrompt = nextStep.value.additionalPrompt;

    switch (nextStep.value.nextPhase) {
        case "Loading_main" :
            agentObject.setFlowState(TaskFlow.Loading.main);
            return;
        case "Plan_createPlan" :
            agentObject.setFlowState(TaskFlow.Plan.createPlan);
            return;
        case "Plan_rePlanning" :
            agentObject.setFlowState(TaskFlow.Plan.rePlan);
            return;
        case "Action_callAgentTool" :
            agentObject.setFlowState(TaskFlow.Action.callTool);
            return; 
        case "Action_messageUser" :
            agentObject.setFlowState(TaskFlow.Action.messageUser);
            return;
        case "Review_newMessageFromUser" :
            agentObject.setFlowState(TaskFlow.Review.newMessage);
            return;
        case "Review_toolOutput" :
            agentObject.setFlowState(TaskFlow.Review.toolOutput);
            return;
        case "Review_contextProcessing" :
            agentObject.setFlowState(TaskFlow.Review.processContext);
            return;
        case "Stopped_draftingFinalOutput" :
            agentObject.setFlowState(TaskFlow.Stopped.FinalOutput);
            return;
        case "Stopped_failed" :
            agentObject.setFlowState(TaskFlow.Stopped.Failed);
            return;
        default:
            agentObject.setFlowState(TaskFlow.Stopped.Failed);
            return;            
    }
}

/**
 * Checks if the last 6 elements of an array contain exactly 
 * two unique strings, one of which must be 'Healing::main'.
 * * @param {string[]} arr - The array of strings to check.
 * @returns {boolean}
 */
function hasFailedMultipleTimes(arr) {
  // Check if there are at least 6 entries
  if (arr.length < 6) {
    return false;
  }
  // Get the last 6 entries
  const lastSix = arr.slice(-6);
  // Determine unique strings using a Set
  const uniqueStrings = new Set(lastSix);
  // Validate requirements:
  // - Must have exactly 2 unique strings
  // - One of them must be 'Healing::main'
  return uniqueStrings.size === 2 && uniqueStrings.has('Healing::main');
}