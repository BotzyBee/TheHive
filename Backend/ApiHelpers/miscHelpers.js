import { Services } from "../SharedServices/index.js";
import { JOBS } from "../SharedServices/v2Agents/engine/jobManager.js";

export function getConfigForFrontend(){
  let rtnObject = {
    AiProviders: Services.callAI.Constants.AiProviders,
    AiModels: Services.callAI.Constants.MODEL_REGISTRY,
    ModelTypes: Services.callAI.Constants.ModelTypes,
    AiQuality: Services.callAI.Constants.AiQuality,
    Agents: {
      taskAgent: "Task_Agent",
      quickAsk: "Quick_Ask_Agent"
    }
  }
  return rtnObject;
}

export function stopJob(jobID){
  let msg = JOBS.jobListManager({ stopJob: jobID });
  if (msg.isErr()) return { error: msg.value };

  const rtnMsg = new Services.aiAgents.Classes.FrontendMessageFormat({
      aiJobId: jobID,
      status: Services.aiAgents.Classes.Status.Stopped,
      isRunning: false,
      messages: [new Services.aiAgents.Classes.TextMessage({ 
          role: Services.aiAgents.Constants.Roles.Agent, 
          textData: `Job ${jobID} has been stopped.` 
      })]
  });
  return rtnMsg;
}