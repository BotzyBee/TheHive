import path from 'path';
import { Services } from '../../../index.js';
import { AiJob } from '../../core/classes.js';
import { TaskFlow } from './constantsAndClasses.js';
import { TA_PromptsAndSchemas as PromptsAndSchemas } from './prompts.js';


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
            currentFlowState: TaskFlow.Loading.default;
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
    
    // this.emitFinalResult();
    // return Services.v2Core.Helpers.Ok("Task Agent has stopped or completed");
                    
    }// end run
}// end Task Agent

