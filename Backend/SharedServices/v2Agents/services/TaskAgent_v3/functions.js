import { TaskAgent } from "./index.js";
import { Services } from "../../../index.js";
import { TaskFlow } from "./constantsAndClasses.js";
import { TA_PromptsAndSchemas as PromptsAndSchemas } from './prompts.js';

let thisT = new TaskAgent(); // for intelisense help

// [][] -- LOADING FUNCTIONS -- [][]
export function loadingMain(agentObject){
    // Flow directly to Planning Stage
    agentObject.setFlowState(TaskFlow.Plan.createPlan);
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
            agentObject.phaseMessage, 
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
        agentObject.task, 
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
    if (toolStep.isErr()) return toolStep;
    // Finalize and Merge Plan
    const newActions = toolStep.value.plan.map(p => new TaskAction(p.action, p.tool));
    // If updating, keep completed actions and append/replace the rest
    const completedOldActions = oldPlan.filter(p => p.complete);
    agentObject.plan = isReplan ? [...completedOldActions, ...newActions] : newActions;

    // [][]  --------------------------------- [][]
    // [][]  -- Set Control Flow Properties -- [][]
    // [][]  --------------------------------- [][]
    // Check for flags (!!Flag)
    agentObject.plansNeedApproved = agentObject.task.toLowerCase().includes("!!plans-need-approved");
    if (agentObject.plansNeedApproved) {
        // Flow to Message User
        agentObject.setFlowState(TaskFlow.Action.messageUser);
        agentObject.TaskState.handoverMessage = "The user needs to approve the plan before we continue.";
        agentObject.TaskState.handoverData = agentObject.plan;
    } else {
        // Flow to Craft Params / Tool Calling
        agentObject.setFlowState(TaskFlow.Action.craftParams);
        agentObject.TaskState.handoverMessage = "Planning step completed - continue to tool calling.";
        agentObject.TaskState.handoverData = [];
    }
    agentObject.maxLoops = agentObject.maxLoopBuffer + agentObject.plan.length;
    return;
}
