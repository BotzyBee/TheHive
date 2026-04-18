import { generateShortID } from "./utils.js";

// These classes must be the same as the ones in the Backend SharedServices Classes for aiMessages.js - 
// they are duplicated here to avoid bundling the entire backend classes into the frontend build. 
export const Roles = {
    User: "User",    // Messages from the user
    Agent: "Agent",  // Messages from Agent / AI 
    Tool: "Tool"     // Messages or data from tools
}

export class BaseMessage {
  constructor(role, metadata = {}) {
    this.id = generateShortID("MSG");
    this.role = role; // as defined in Roles object
    this.timestamp = new Date();
    this.metadata = metadata; // for counting ai calls etc
  }

  toJSON() {
    return { ...this };
  }
}

/**
 * Text Message
 * @param {object} input 
 * @param {Roles} [input.role] - Role as defined in the Roles object.
 * @param {string} [input.mimeType] - the mime type of the text data. Defaults to "text/plain".
 * @param {string} [input.textData] - the 'content' of the text message.
 * @param {any} [input.toolName] -  optional, the name of the tool used.
 * @param {any} [input.instructions] - optional, the instructions passed to the tool.
 */
export class TextMessage extends BaseMessage {
  constructor({ role, mimeType, textData, toolName, instructions, metadata } = {}) {
    super(role, metadata);
    this.type = 'text';
    this.mime = mimeType || "text/plain";
    this.ext = "txt";
    this.textData = textData;
    this.toolName = toolName;
    this.instructions = instructions;
  }
}

/**
 * Image Message
 * @param {object} input 
 * @param {Roles} [input.role] - Role as defined in the Roles object.
 * @param {string} [input.mimeType] - the mime type of the text data. Defaults to "image/png".
 * @param {string} [input.url] - optional, url location of the image. 
 * @param {string} [input.base64] - optional if url provided, base64 representation of the image.
 * @param {string} [input.altText] - optional, any alt text for the image.
 * @param {any} [input.toolName] -  optional, the name of the tool used.
 * @param {any} [input.instructions] - optional, the instructions passed to the tool.
 */
export class ImageMessage extends BaseMessage {
  constructor({ role, mimeType, url, base64, altText, toolName, instructions, metadata } = {}) {
    super(role, metadata);
    this.type = 'image';
    this.mime = mimeType || "image/png";
    this.ext = "png";
    this.url = url;
    this.base64 = base64;
    this.altText = altText;
    this.toolName = toolName;
    this.instructions = instructions;
  }
}

/**
 * Audio Message
 * @param {object} input 
 * @param {Roles} [input.role] - Role as defined in the Roles object.
 * @param {string} [input.mimeType] - the mime type of the text data. Defaults to "audio/mp4".
 * @param {string} [input.url] - optional, url location of the audio file. 
 * @param {string} [input.base64] - optional if url provided, base64 representation of the audio.
 * @param {string} [input.transcript] - optional, any transcript.
 * @param {any} [input.toolName] -  optional, the name of the tool used.
 * @param {any} [input.instructions] - optional, the instructions passed to the tool.
 */
export class AudioMessage extends BaseMessage {
  constructor({ role, mimeType, url, base64, transcript, toolName, instructions, metadata } = {}) {
    super(role, metadata);
    this.type = 'audio';
    this.mime = mimeType || "audio/mp4";
    this.ext = "wav";
    this.url = url;
    this.base64 = base64;
    this.transcript = transcript; // Multimodal models often provide both
    this.toolName = toolName;
    this.instructions = instructions;
  }
}

/**
 * Data message - for passing JSON, JS Object etc.
 * @param {object} input 
 * @param {Roles} [input.role] - Role as defined in the Roles object.
 * @param {string} [input.mimeType] - optional, the mime type of the data. Defaults to null (JS object/ array)
 * @param {any} [input.data] - the main data content
 * @param {any} [input.toolName] -  optional, the name of the tool used.
 * @param {any} [input.instructions] - optional, the instructions passed to the tool.
 */
export class DataMessage extends BaseMessage {
  constructor({ role, mimeType, data, toolName, instructions, metadata } = {}) {
    super(role, metadata);
    this.type = 'data';
    this.mime = mimeType || null;
    this.ext = "json";
    this.data = data;
    this.toolName = toolName;
    this.instructions = instructions;
  }
}

// For passing messages between Backend <> Frontend
/**
 * constructor { aiJobId, aiSettings }
 * Data - this.messages, this.aiJobId, this.aiSettings
 */
export class FrontendMessageFormat{
 constructor({ aiJobId, aiSettings, status, isRunning, metadata, messages } = {}) {
    this.aiJobId = aiJobId || null;
    this.isRunning = isRunning ?? null;
    this.metadata = metadata || {};
    this.status = status || null;
    this.aiSettings = aiSettings || {};
    this.messages = messages || [];
  }

  clearMessages(){
    this.messages = [];
    return this;
  }

  /**
   * Adds one or more messages to the Frontend Message Class.
   * @param {array<BaseMessage>} messageArray - Array of BaseMessage class or any class that extends it.
   */
  addMessages(messageArray){
    if(Array.isArray(messageArray)){
      messageArray.forEach((msg) => {
        if(msg instanceof BaseMessage){
          this.messages.push(msg);
        }
      })
    }
  }

}