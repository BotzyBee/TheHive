import { Services } from "../index.js";

export const Roles = {
    User,   // Messages from the user
    Agent,  // Messages from Agent / AI 
    Tool    // Messages or data from tools
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
            return Services.Utils.Err(``);
        }
        this.allMessages.push(messageInstance);
    }

    /**
     * Get all user and system messages as string
     * @returns {string} - returns all messages separated by \n\n
     */
    getAllMessagesString(){
        return this.allMessages
        .map(msg => JSON.stringify(msg))
        .join('\n\n');
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

class BaseMessage {
  constructor(role, metadata = {}) {
    this.id = Services.Utils.generateShortID("MSG");
    this.role = role; // as defined in Roles object
    this.timestamp = new Date();
    this.metadata = metadata;
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
  constructor({ role, mimeType, textData, toolName, instructions } = {}) {
    super(role);
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
  constructor({ role, mimeType, url, base64, altText, toolName, instructions } = {}) {
    super(role);
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
  constructor({ role, mimeType, url, base64, transcript, toolName, instructions } = {}) {
    super(role);
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
  constructor({ role, mimeType, data, toolName, instructions } = {}) {
    super(role);
    this.type = 'data';
    this.mime = mimeType || null;
    this.data = data;
    this.toolName = toolName;
    this.instructions = instructions;
  }
}