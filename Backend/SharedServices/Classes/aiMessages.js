import { Services } from "../index.js";

export const Roles = {
    User: "User",    // Messages from the user
    Agent: "Agent",  // Messages from Agent / AI 
    Tool: "Tool"     // Messages or data from tools
}

/**
 * Main Holder of Messages from user, agent and tools. 
 */
export class MessageLog {
    #messageCount;
        constructor() {
        this.#messageCount = 0;
        this.allMessages = [];
    }

    /**
     * Adds a message to the Message Log
     * @param {TextMessage | ImageMessage | AudioMessage | DataMessage} messageInstance
     */
    addMessage(messageInstance) {
        if (!(messageInstance instanceof BaseMessage)) {
            return Services.Utils.Err('Messages must be an instance of BaseMessage or a class that extends it.');
        }
        this.allMessages.push(messageInstance);
    }

    /**
     * Get All messages as string - ALL TYPES FULL DATA!
     * @returns {string} - returns all messages separated by \n\n
     */
    getAllMessagesString(){
        return this.allMessages
        .map(msg => JSON.stringify(msg))
        .join('\n\n');
    }

    /**
     * Returns shortened version of all text messages between User and Agent. { role, message }
     * @returns {string} - returns all 'Text' messages separated by \n\n 
     */
    getSimpleUserAgentComms() {
    return this.allMessages
        .filter(msg => msg?.type === 'Text' && (msg?.role === Roles.Agent || msg?.role === Roles.User ))
        .map(msg => `${msg.role}: ${msg.textData}`) // Convert object to a string line
        .join('\n\n');
    }

    /**
     * Get all Tool messagegs from Message Log and return as object.
     * @returns {object} - Object containing all Tool messages. Key is the message ID.
     */
    getToolMessagesAsObject(){
      let rtnObject = {};
      let allToolMsgs = this.allMessages.filter(msg => msg?.role === Roles.Tool );
      const msgLen = allToolMsgs.length ?? 0;
      for(let i=0; i<msgLen; i++){
        rtnObject[allToolMsgs[i].id] = allToolMsgs[i];
      }
      return rtnObject;
    }

    /**
     * Get a message by it's unique id
     * @returns {TextMessage | ImageMessage | AudioMessage | DataMessage}
     */
    getMessagesById(messageID){
      let allToolMsgs = this.allMessages.filter(msg => msg?.id === messageID );
      let len = allToolMsgs.length ?? 0;
      return len === 0 ? null : allToolMsgs[0];
    }

    /**
     * Get all user and system messages as an array of objects
     * @returns {array[object]} - returns an array of {source: 'user' | 'agent', data: any} objects
     */
    getAllMessagesArray(){
      return this.allMessages;
    }

    /**@returns {number} - total number of messages */
    getMessageCount(){
      return this.#messageCount;
    }

    clearAllMessages() {
        this.messages = [];
    }
}

export class BaseMessage {
  constructor(role, metadata = {}) {
    this.id = Services.Utils.generateShortID("MSG");
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
    this.data = data;
    this.toolName = toolName;
    this.instructions = instructions;
  }
}