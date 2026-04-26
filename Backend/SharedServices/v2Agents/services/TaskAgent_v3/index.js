import path from 'path';
import { Services } from '../../../index.js';
import { AiJob } from '../../core/classes.js';
import { TaskFlow } from './constantsAndClasses.js';



export class TaskAgent extends AiJob {
    constructor({ 
            task = "", 
            aiSettings = {}, 
            toolRetryCount = 1,
            maxLoopBuffer = 5,
            summaryDataSizeThreshold = 500,
            socketId = null,
            emitFunction = null,
            whoGetsUpdates = null,
            skipReviewTools,
            callFactory = null
        } = {}){
        super({aiSettings, socketId, emitFunction, whoGetsUpdates, callFactory}) // setup parent class
        this.messageHistory.addMessage(new Services.aiAgents.Classes.TextMessage({ role: Services.aiAgents.Constants.Roles.User, textData: task}));
        this.task = task;
        this.agentType = "TaskAgent"; 

        // Additional Tool Vars
        this.toolRetryCount = toolRetryCount; // how many times to try a tool.

        // Workflow
        this.plan = []; // array of TaskAction class objects
        this.TaskState = {
            currentFlowState: TaskFlow.Loading.main,
            stateHistory: [],
            handoverMessage: "",
            handoverData: []
        }
        this.maxLoopBuffer = maxLoopBuffer; // Gives the agent X number of extra loops to ask questions/ attempt fixes etc.
        this.maxLoops = 10; // this is updated when a plan is created.
        this.summaryDataSizeThreshold = summaryDataSizeThreshold; // How many characters before context summarisation
        this.toolOutputData = []; // temp holds tool output prior to review;
        this.debugParams = []; // used to store params crafted for tools for debugging and improvement purposes.
        this.skipReviewTools = skipReviewTools || ['createCodeTool', 'deepResearchTool', 'superWriterTool']; // Outputs from these tools aren't critiqued (they have their own QA process!)
    }

    // [][] -- HELPER FUNCTIONS -- [][]
    getNextAction(){ 
        let actionLen = this.plan.length ?? 0; 
        for(let i=0; i<actionLen; i++){
            if(this.plan[i]?.complete == false){
                return this.plan[i];
            }
        }
        return null;
    }
    updateAction(actionID, actionText, tool){
        let actionLen = this.plan.length ?? 0; 
        for(let i=0; i<actionLen; i++){
            if(this.plan[i]?.id == actionID){
                if(actionText) this.plan[i].action = actionText;
                if(tool) this.plan[i].tool = tool;
            }
        }
        return null;
    }
    incrimentActionCount(actionID){ 
        const actionToUpdate = this.plan.find(act => act.id === actionID);
        if (actionToUpdate) {
            actionToUpdate.attempt += 1;
        }
    }
    setActionComplete(actionID){ 
        const actionToUpdate = this.plan.find(act => act.id === actionID);
        if (actionToUpdate) {
            actionToUpdate.complete = true;
        }
    }
    setActionText(actionID, actionText){ 
        if(actionID && typeof actionText == "string"){
            const actionToUpdate = this.plan.find(act => act.id === actionID);
            if (actionToUpdate) {
                actionToUpdate.action = actionText;
            }
        }
    }
    fetchAction(actionID){ 
        const action = this.plan.find(act => act.id === actionID);
        if (action) {
            return action;
        }
        return null;     
    }
    setFlowState(state){
        this.TaskState.currentFlowState = state;
        this.TaskState.stateHistory.push(state)
    }
    getOustandingActionCount(){ 
        let outstandingActions = this.plan.filter(item => item.complete === false);
        let count = outstandingActions.length ?? 0;
        return count;
    }

    getSummaryContextByActionID(actionID){
       return Object.fromEntries(
        Object.entries(this.contextData.toolData).filter(([key, value]) => {
            return value.metadata?.actionID === actionID;
            })
        );
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
    async generateText(systemMessage, userMessage, options = this.aiSettings){
        let call;
        for (let i = 0; i < this.toolRetryCount; i++) {
            call = await this.aiCall.generateText(systemMessage, userMessage, options); 
            this.addAiCount(1);
            if (call.isOk()) return call; // already has result
        }
        const errorMsg = `Error ( TaskAgent - #generateText ) : ${JSON.stringify(call.value, null, 2)}`;
        this.errors.push(errorMsg);
        return Services.v2Core.Helpers.Err(errorMsg);        
    }

    // used in planning function
    async getSuitableGuides(task, maxGuides = 10){
        // Get guides by vector lookup
        let matchingGuides = await Services.database.Helpers.getToolsOrGuidesForTask(task, maxGuides, false); // false = search guides not tools
        if(matchingGuides.isErr()){
            return Services.v2Core.Helpers.Err(`Erorr (getSuitableGuides -> getToolsOrGuidesForTask) : ${JSON.stringify(matchingGuides.value, null, 2)}`);
        }
        // Use AI to select the most suitable
        let call = await this.generateText(
            "Your task is to review the provided guide text and return the file path for any guides that could be useful for the user task. " +
            "If none are relevant return an empty array. This is better than adding irrelevant guides to the plan. ",
            `Here is the user task : ${task} and here are the guides : ${JSON.stringify(matchingGuides.value)}`,
            { ...this.aiSettings, 
                structuredOutput: {
                "type": "object",
                "description": "An object containing a filePaths property which is an array of string values.",
                "properties": {
                    "filePaths": {
                    "type": "array",
                    "items": {
                        "type": "string"
                    }
                    }
                },
                "required": ["filePaths"]
                }
            }
        );
        if(call.isErr()){
            return Services.v2Core.Helpers.Err(`Error (getSuitableGuides -> generateText ) : ${JSON.stringify(call.value, null, 2)}`);
        }
        // fetch the texts
        let OPlen = call.value.filePaths.length ?? 0;
        let OPAR = [];
        for(let i=0; i<OPlen; i++){
            const readFile = await Services.fileSystem.CRUD.readFileContent(call.value.filePaths[i]);
            if(readFile.isErr()){ return readFile };
            OPAR.push(readFile.value);
        }
        console.log(`${OPAR.length} Guides have been added to planing process.`);
        OPAR.join("\n Next Guide : \n\n")
        return Services.v2Core.Helpers.Ok(OPAR);
    }

    // used in planning function
    getCompletedActionsSummary() {
        const completed = this.plan.filter(item => item.complete);
        if (!completed.length) return "No prior actions have been completed.";
        return "The following actions have been completed:\n" + 
               completed.map((item, i) => `${i + 1}. ${item.action}`).join('\n');
    }

    /**
     * Processes tool outputs into a summary & full outputs
     * @param {array} toolOutputArray - Array of aiMessage types 
     * @return {Result} - Result({ summaryObj: summary data object, rawDataMessage: DataMessage (full tool output) })
     */
    async processToolOutput(toolOutputArray){
        // Process messages from tool call
        let newMessageLen = toolOutputArray.length ?? 0;
        let summary = {};
        const toolNm = toolOutputArray[0].toolName || "";
        for(let i=0; i<newMessageLen; i++){
            // Shorten & add to context
            if(toolOutputArray[i].role === Services.aiAgents.Constants.Roles.Tool){
                console.log("Processing Tool Message... ");
                let processed = await Services.aiAgents.AgentSharedServices.processMessageForContext(toolOutputArray[i], this.summaryDataSizeThreshold, this.aiSettings, this );
                if(processed.isErr()){
                    return Services.v2Core.Helpers.Err(`Error : ( processToolOutput ) : ${processed.value}`);   
                }
                // Add data to tool context;
                let k = processed.value.key;
                summary[`${k}`] = processed.value[`${k}`];
            } 
        }
        return Services.v2Core.Helpers.Ok({summaryObj: summary, rawMessages: toolOutputArray});
    }

    // [][] --- MAIN ENTRY POINT --- [][]
    async run(){

        console.log("Starting Task Agent Job")
        // Start / Re-start the agent
        this.isRunning = true;
        this.taskOutput = [];
        if(this.startEpochMs == 0) this.setStartTime();
            
        // Main Loop
        while(this.isRunning == true){

            switch (this.TaskState.currentFlowState) {
                // [][] -- LOADING ACTIONS -- [][]
                case TaskFlow.Loading.main:
                // function(this)
                break;
                
                // [][] -- PLANNING ACTIONS -- [][]
                case TaskFlow.Plan.createPlan:
                case TaskFlow.Plan.rePlan:
                // function(this)
                break;

                // [][] -- AGENT ACTIONS -- [][]
                case TaskFlow.Action.craftParams:
                // function(this)
                break;
                case TaskFlow.Action.callTool:
                // function(this)
                break;

                // [][] -- REVIEW ACTIONS -- [][]
                case TaskFlow.Review.newMessage:
                // function(this)
                break;
                case TaskFlow.Review.toolOutput:
                // function(this)
                break;  
                case TaskFlow.Review.processContext:
                // function(this)
                break;          

                // [][] -- STOPPED STATES -- [][]
                case TaskFlow.Stopped.Failed:
                // function(this)
                break;
                case TaskFlow.Stopped.AwaitUser:
                // function(this)
                break;
                case TaskFlow.Stopped.Stopped:
                // function(this)
                break;  
                case TaskFlow.Stopped.FinalOutput:
                // function(this)
                break;  
                case TaskFlow.Stopped.Complete:
                // function(this)
                break;

                // [][] -- HEALING / FIXES -- [][]
                case TaskFlow.Healing.main:
                // function(this)
                break;
            }// end switch

            // catch max loops
            if(this.stats.loopNumber >= this.maxLoops){
                // let e = `Error: Maximum loop count of ${this.maxLoops} exceeded.`;
                // this.errors.push(e);
                // console.log(e);
                // this.status.setMaxLoopsHit()
                // this.emitFailed();
                // this.nextPhase = TaskPhases.Review;
            }
            this.addLoopCount(1);
        }// end loop

    // this.setEndTime();
    // this.debugParams = [];
    // const targetDirectoryInContainer = path.join(Services.fileSystem.Constants.containerVolumeRoot, 'UserFiles/TestJobs/');
    // await Services.fileSystem.CRUD.saveFile(targetDirectoryInContainer, JSON.stringify(this, null, 2), `${this.id}.txt`);
    
    this.emitFinalResult();
    return Services.v2Core.Helpers.Ok("Task Agent Run Complete");
                    
    }// end run
}// end Task Agent

