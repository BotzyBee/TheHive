import { TextMessage, ImageMessage, AudioMessage, DataMessage } from "../core/classes.js";
import { Services } from "../../index.js";

export function processApiMessagesToClasses(messageArray) {
  if (!Array.isArray(messageArray)) {
    return Services.coreTools.Helpers.Err(`Error (processApiMessagesToClasses) - Input must be an array!`);
  }
  const outputArray = messageArray.map((msg) => {
    switch (msg.type) {
      case 'text':
        return new TextMessage(msg);
      case 'image':
        return new ImageMessage(msg);
      case 'audio':
        return new AudioMessage(msg);
      case 'data':
        return new DataMessage(msg);
      default:
        return Services.coreTools.Helpers.Err(`Error (processApiMessagesToClasses) : Unknown message type: ${msg.type}`);
    }
  });
  return Services.coreTools.Helpers.Ok(outputArray);
}