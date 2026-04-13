import { FrontendMessageFormat } from "../../SharedServices/Classes/index.js";
import { JOBS } from "../jobManager.js";
import { TextMessage } from "../../SharedServices/Classes/index.js";
import { processApiMessagesToClasses } from './index.js';
import { Ok, Err } from '../../SharedServices/Utils/helperFunctions.js';
import { QuickAskAgent } from "../../SharedServices/Agents/QuickAsk/index.js";
import { Roles, Status }from '../../SharedServices/Classes/index.js';

/**
 * Creates a new QuickAsk Agent and adds it to non-allocated jobs.
 * @param {FrontendMessageFormat} frontendMessage 
 * @returns {Result<FrontendMessageFormat | string>} - Result( FrontendMessageFormat | string )
 */
export async function createQuickAskJob(frontendMessage, socketId = null){
    if(!frontendMessage instanceof FrontendMessageFormat){
        return Err(
            'Error (createQuickAskJob) : frontendMessage is not a FrontendMessageFormat class message.'
        );
    }
    // To Do - Handle multiple frontend messages - IE Task message and data context. 
    let message = frontendMessage.messages[0]?.textData || null;
    if(message == null){
        return Err(
            'Error (createQuickAskJob) : frontendMessage.messages[0] is not a TextMessage Class'
        );
    }
    let job = new QuickAskAgent({
        task: message,
        aiSettings: frontendMessage.aiSettings,
        socketId: socketId,
    });
    // add to queue
    JOBS.addNewJob(job);
    let rtnMessage = new FrontendMessageFormat({
        aiJobId: job.id, 
    });
    let msg = new TextMessage({
        role: Roles.Agent,
        textData: `Quick-Ask Job has been created and is awaiting allocation. \n Ref: ${job.id}`
    });
    rtnMessage.addMessages([msg]);
    return Ok(rtnMessage);
}

export async function handleQAMessage(frontendMessage, socketId = null){
    // Process Messages
    let id = frontendMessage.aiJobId;
    let msg = new FrontendMessageFormat({ aiJobId: id, aiSettings: frontendMessage.aiSettings });
    let processedMsg = processApiMessagesToClasses(frontendMessage.messages);
    if( processedMsg.isErr() ){ 
    return Err(`Error : could not process the messages into classes. ${processedMsg.value}`);
    }
    msg.addMessages(processedMsg.value);
    // No ID - New Task
    if(id == null){
    let newJob = await createQuickAskJob(msg, socketId);
    if(newJob.isErr()){
        return Err(`Error : (createQuickAskJob) - ${newJob.value}`);
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
            return Err(`Error : (handleQAMessage) - ${job.value}`);
        } 
        let processedMsg = processApiMessagesToClasses(frontendMessage.messages);
        if( processedMsg.isErr() ){ 
            return Err(`Error (handleQAMessage 2) : could not process the messages into classes. ${processedMsg.value}`);
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
            return Ok(rtnMsg);
        }

        // Catch still running
        if(job.value.isRunning == true){
            return Err(`Job ${id} is still running. Cannot add new instructions unless stopped or complete.`)
        }

        // add new messages to messageHistory
        processedMsg.value.forEach(
            msg => job.value.messageHistory.addMessage(msg)
        );
        // Setup to review new messages
        job.value.status.setNewInfoAdded();
        // Clear output to stop polling from picking up old output.
        job.value.taskOutput = [];
        // Add to un-allocated
        JOBS.NON_ALLOCATED.push(job.value.id);
        rtnMsg.addMessages(
            new TextMessage({
                role: Roles.Agent,
                textData: `New information has been added to Job ${id} and is awaiting allocation.`
            })
        )
        return Ok(rtnMsg);
    }
}