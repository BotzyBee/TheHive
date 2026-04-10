import { Services } from '../../SharedServices/index.js';
export * as QuickAskRoute from './quickAsk.js';

export function processApiMessagesToClasses(messageArray) {
  if (!Array.isArray(messageArray)) {
    return Services.Utils.Err(`Error (processApiMessagesToClasses) - Input must be an array!`);
  }
  const outputArray = messageArray.map((msg) => {
    switch (msg.type) {
      case 'text':
        return new Services.Classes.TextMessage(msg);
      case 'image':
        return new Services.Classes.ImageMessage(msg);
      case 'audio':
        return new Services.Classes.AudioMessage(msg);
      case 'data':
        return new Services.Classes.DataMessage(msg);
      default:
        return Services.Utils.Err(`Error (processApiMessagesToClasses) : Unknown message type: ${msg.type}`);
    }
  });
  return Services.Utils.Ok(outputArray);
}

export function getConfigForFrontend(){
  let rtnObject = {
    AiProviders: Services.Constants.AiProviders,
    AiModels: Services.Constants.MODEL_REGISTRY,
    ModelTypes: Services.Constants.ModelTypes,
    AiQuality: Services.Constants.AiQuality,
    Agents: {
      taskAgent: "Task_Agent",
      quickAsk: "Quick_Ask_Agent"
    }
  }
  return rtnObject;
}