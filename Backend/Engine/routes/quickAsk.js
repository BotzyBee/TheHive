import { FrontendMessageFormat } from "../../SharedServices/Classes/index.js";
import { Services } from "../../SharedServices/index.js";
import { JOBS } from "../jobManager.js";
import { TextMessage } from "../../SharedServices/Classes/index.js";
import { processApiMessagesToClasses } from './index.js';

/**
 * Creates a new QuickAsk Agent and adds it to non-allocated jobs.
 * @param {FrontendMessageFormat} frontendMessage 
 * @returns {Result<FrontendMessageFormat | string>} - Result( FrontendMessageFormat | string )
 */
export async function createQuickAskJob(frontendMessage){
    if(!frontendMessage instanceof FrontendMessageFormat){
        return Services.Utils.Err(
            'Error (createQuickAskJob) : frontendMessage is not a FrontendMessageFormat class message.'
        );
    }
    // To Do - Handle multiple frontend messages - IE Task message and data context. 
    let message = frontendMessage.messages[0]?.textData || null;
    if(message == null){
        return Services.Utils.Err(
            'Error (createQuickAskJob) : frontendMessage.messages[0] is not a TextMessage Class'
        );
    }
    let job = new Services.Agents.QuickAsk.QuickAskAgent({
        task: message,
        aiSettings: frontendMessage.aiSettings
    });
    // add to queue
    JOBS.addNewJob(job);
    let rtnMessage = new FrontendMessageFormat({
        aiJobId: job.id, 
    });
    let msg = new TextMessage({
        role: Services.Classes.Roles.Agent,
        textData: `Quick-Ask Job has been created and is awaiting allocation. \n Ref: ${job.id}`
    });
    rtnMessage.addMessages([msg]);
    return Services.Utils.Ok(rtnMessage);
}

export async function handleQAMessage(frontendMessage){
    // Process Messages
    let id = frontendMessage.aiJobId;
    let msg = new FrontendMessageFormat({ aiJobId: id, aiSettings: frontendMessage.aiSettings });
    let processedMsg = processApiMessagesToClasses(frontendMessage.messages);
    if( processedMsg.isErr() ){ 
    return Services.Utils.Err(`Error : could not process the messages into classes. ${processedMsg.value}`);
    }
    msg.addMessages(processedMsg.value);
    // No ID - New Task
    if(id == null){
    let newJob = await createQuickAskJob(msg);
    if(newJob.isErr()){
        return Services.Utils.Err(`Error : (createQuickAskJob) - ${newJob.value}`);
    }
    return newJob; // has Result already
    } else {

    // Clear output to stop polling from picking up old output.
    //job.value.taskOutput = [];
    // Existing Task
    // To Do
    console.log("Existing Job");
    }
}