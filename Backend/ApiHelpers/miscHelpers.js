import { Services } from "../SharedServices/index.js";

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