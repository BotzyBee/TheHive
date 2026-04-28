import { FrontendMessageFormat, TextMessage, Status } from "../core/classes.js";
import { JOBS } from "./jobManager.js";
import { Roles } from "../core/constants.js";
import { processApiMessagesToClasses } from "../services/processMessages.js";
import { TaskAgent } from "../services/TaskAgent_v3/index.js";
import { TaskFlow } from "../services/TaskAgent_v3/constantsAndClasses.js";
//import { TaskAgent, TaskPhases } from "../services/TaskAgent/index.js";
import { Services } from "../../index.js";

/**
 * Creates a new QuickAsk Agent and adds it to non-allocated jobs.
 * @param {FrontendMessageFormat} frontendMessage 
 * @param {string} socketId - Socket ID to link the job to the correct user for updates.
 * @returns {Result<FrontendMessageFormat | string>} - Result( FrontendMessageFormat | string )
 */
export async function createTaskAgentJob(frontendMessage, socketId){
    if(!frontendMessage instanceof FrontendMessageFormat){
        return Services.v2Core.Helpers.Err(
            'Error (createTaskAgentJob) : frontendMessage is not a FrontendMessageFormat class message.'
        );
    }
    // To Do - Handle multiple frontend messages - IE Task message and data context. 
    let message = frontendMessage.messages[0]?.textData || null;
    if(message == null){
        return Services.v2Core.Helpers.Err(
            'Error (createTaskAgentJob) : frontendMessage.messages[0] is not a TextMessage Class'
        );
    }
    let factory = await Services.callAI.aiFactory();
    let job = new TaskAgent({
        task: message, 
        aiSettings: frontendMessage.aiSettings, 
        socketId: socketId,
        callFactory: factory,
        // All below are optional
        //toolRetryCount, 
        //maxLoopBuffer, 
        //summaryDataSizeThreshold
    })

    // add to queue
    JOBS.addNewJob(job);
    let rtnMessage = new FrontendMessageFormat({
        aiJobId: job.id, 
    });
    let msg = new TextMessage({
        role: Roles.Agent,
        textData: `Task-Agent Job has been created and is awaiting allocation. \n Ref: ${job.id}`
    });
    rtnMessage.addMessages([msg]);
    return Services.v2Core.Helpers.Ok(rtnMessage);
}

export async function handleTAMessage(frontendMessage, socketId = null){
    // Process Messages
    let id = frontendMessage.aiJobId;
    // No ID - New Task
    if(id == null){
        let rtnMsg = new FrontendMessageFormat({ 
            aiJobId: id, 
            aiSettings: frontendMessage.aiSettings,
            status: Status.NotStarted
        });
        let processedMsg = processApiMessagesToClasses(frontendMessage.messages);
        if( processedMsg.isErr() ){ 
        return Services.v2Core.Helpers.Err(`Error (handleTAMessage) : could not process the messages into classes. ${processedMsg.value}`);
        }
        rtnMsg.addMessages(processedMsg.value);
        let newJob = await createTaskAgentJob(rtnMsg, socketId);
        if(newJob.isErr()){
            return Services.v2Core.Helpers.Err(`Error : (handleTAMessage) - ${newJob.value}`);
        }
        return newJob; // has Result already
    } else {
    // Existing Task
        let rtnMsg = new FrontendMessageFormat({ 
            aiJobId: id, 
            aiSettings: frontendMessage.aiSettings,
            status: Status.NotStarted,
        });
        // Get JOB Object
        let job = await JOBS.jobListManager({getJob: id});
        if(job.isErr()){
            return Services.v2Core.Helpers.Err(`Error : (handleTAMessage) - ${job.value}`);
        } 
        let processedMsg = processApiMessagesToClasses(frontendMessage.messages);
        if( processedMsg.isErr() ){ 
            return Services.v2Core.Helpers.Err(`Error (handleTAMessage 2) : could not process the messages into classes. ${processedMsg.value}`);
        }
        // Handle Stop
        if(frontendMessage.status == Status.Stopped){
            job.value.isRunning = false;
            job.value.status.setStoppedByUser();
            rtnText = `Job ${id} has been stopped`;
            rtnMsg.addMessages(
                new TextMessage({
                    role: Roles.Agent,
                    textData: `Job ${id} has been stopped`
                })
            )
            return Services.v2Core.Helpers.Ok(rtnMsg);
        }

        // Catch still running
        if(job.value.isRunning == true){
            return Services.v2Core.Helpers.Err(`Job ${id} is still running. Cannot add new instructions unless stopped or complete.`)
        }

        // add new messages to messageHistory
        processedMsg.value.forEach(
            msg => job.value.messageHistory.addMessage(msg)
        );
        // Setup to review new messages
        job.value.setFlowState(TaskFlow.Review.newMessage);
        // Clear output to stop polling from picking up old output.
        job.value.taskOutput = [];
        job.value.stats.loopNumber = 0; // reset loop number to allow for new loop of agent actions.
        // Add to un-allocated
        JOBS.NON_ALLOCATED.push(job.value.id);
        rtnMsg.addMessages(
            new TextMessage({
                role: Roles.Agent,
                textData: `New information has been added to Job ${id} and is awaiting allocation.`
            })
        )
        return Services.v2Core.Helpers.Ok(rtnMsg);
    }
}