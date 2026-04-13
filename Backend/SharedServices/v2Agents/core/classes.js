import { Services } from "../../index.js";

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
            return;
        }
        this.#messageCount++;
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
        .filter(msg => msg?.type === 'text' && (msg?.role === Roles.Agent || msg?.role === Roles.User ))
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
        this.allMessages = [];
        this.#messageCount = 0;
    }
}

export class BaseMessage {
  constructor(role, metadata = {}) {
    this.id = Services.v2Core.Utils.generateShortID("MSG");
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


// [][] ------------------------------------------ [][]
// [][] -- Base constants / classes for AI Jobs -- [][]
// [][] ------------------------------------------ [][]

/*
* NOTE - Context handling. All messages (text, image, data, audio etc) are added to the message history.
* Summerised versions of tool output is added to toolContext - for planning. 
*/

export class ContextTemplate {
    constructor(jobID) {
        this.globalData = {
            timeAndDate: "",
            jobID: jobID  || "Job ID not set"
        };
        this.toolData = {}; 
        this.updateDateTime();
    }

    /**
     * Updates globalData.timeAndDate with current time/ date.
     */
    updateDateTime(){
        let getDT = Services.v2Core.Timers.getDateTime();
        if(getDT.isOk()){
            let d = getDT.value;
            this.globalData.timeAndDate = `Today is ${d.dayOfWeek} ${d.dayOfMonth} ${d.monthName} ${d.year} (Epoch: ${d.currentEpoch}, Date: ${d.fullDateTime}). The user is in timezone: ${d.timezone}`;
        }
    }

    /**
     * Adds a key and value to the Global Data Context
     * @param {string} key  
     * @param {any} value 
     */
    addCustomGlobalContext(key, value){
        this.globalData[key] = value;
    }

    /**
     * Returns the full context (global / tool) as JSON string
     * @returns {string} - JSON String
     */
    getFullContextString(){
        return JSON.stringify(this, null, 2);
    }

    /**
     * Returns the Global Context as JSON string
     * @returns {string} - JSON String
     */
    getGlobalContextString(){
        return JSON.stringify(this.globalData, null, 2);
    }
    
    /**
     * Returns all Tool Data (summary) as JSON string
     * @returns {string} - JSON String
     */
    getToolContextString(){
        return JSON.stringify(this.toolData, null, 2);
    }

    /**
     * Returns the tool data object. Note tool data may have been shortened. 
     * @returns {object} 
     */
    getAllToolsContext(){
        return this.toolData;
    }

    /**
     * Returns a single tool data object. Note tool data may have been shortened. 
     * @returns {object | null} - 
     */
    getSingleToolContext(toolID){
        if(typeof toolID === "string" && toolID != ""){
            let toolData = this.toolData[toolID] ?? null;
            return toolData;
        }
    }

    getAllContext(){
        return this;
    }

    /**
     * Import a Context Template object - useful for passing between threads
     * @param {object} data - Context object 
     * @returns - returns this
     */
    import(data) {
    if (!data || typeof data !== 'object') return;
    // Iterate through the keys of the incoming object
    Object.keys(data).forEach(key => {
        // Only map if the property already exists in 'this'
        if (Object.prototype.hasOwnProperty.call(this, key)) {
            this[key] = data[key];
        }
    });
    return this;
    }
}


// Base Class for all AI Jobs / Agents 
// NOTE emitToSocketFunction can be found here - "../../ApiHelpers/socketHelpers.js";
export class AiJob {
  constructor({ idPrefix = "AI", aiSettings, socketId, emitToSocketFunction } = {}){ 
    /**@type {string} */
    this.id = Services.v2Core.Utils.generateLongID(idPrefix);

    /**@type {string | null} - Socket ID for linking to the correct user for updates */
    this.socketId = socketId || null; 

    this.emitToSocket = emitToSocketFunction;

    /**@type {string} - used to differentiate between base class and classes that extend AiJob*/
    this.agentType = "AiJob";

    /**@type {string}  - for managing the overall user task. */
    this.task = "";

    this.aiCall = Services.callAI.aiFactory(); // for making aiCalls.

    /**@type {TaskStatus} */
    this.status = new TaskStatus();

    /**@type {ContextTemplate} - Global and Summary Tool Data */
    this.contextData = new ContextTemplate(this.id);

    /**@type {object} - Optional settings passed to aiCall eg. provider, quality */
    this.aiSettings = aiSettings || {}

    /**@type {[]TextMessage | ImageMessage | AudioMessage | DataMessage } - For returning data to the user. This will be one or more 'messsages'. */
    this.taskOutput = [];

    /**@type {number} - The start time (epoch) when the Job was started */
    this.startEpochMs = 0;

    /**@type {number} - The end time (epoch) when the Job was fully completed/ stopped */
    this.endEpochMs = 0;

    /**@type {array[string]} - Array of errors for debugging. */
    this.errors = [];

    /**@type {MessageLog} - Chat log class for holding and managing user & agent messages */
    this.messageHistory = new MessageLog();

    /**@type {boolean} - true if job is actively being worked on. */
    this.isRunning = false;

    /**@type {object} -  { toolCount: 0, aiCount: 0, loopNumber: 0, custom: {} }*/
    this.stats = { toolCount: 0, aiCount: 0, loopNumber: 0, custom: {} }
  }

  /** Run must be implemented in any subclasses - the run function must start / handle the main agent loop or actions. */
  async run() {
    return "Method 'run()' must be implemented in the subclass";
  }

  /**
   * Sends status update back to the user. 
   * @param {string} statusMessage - Status text to send to the user.
   */
  emitUpdateStatus(statusMessage){
    if(this.socketId && this.isRunning == true){
        let status = new TaskStatus();
        status.setCustomStatus(statusMessage);
        let fmf = new FrontendMessageFormat({
            aiJobId: this.id,
            status: status,
            isRunning: this.isRunning,
            messages: [],
            metadata: this.stats
        });
        this.emitToSocket(this.socketId, 'job_update', fmf);
    }
  }

  emitFinalResult(){
    if(this.socketId){
        let res = new FrontendMessageFormat({ 
            aiJobId: this.id, 
            status: this.status, 
            isRunning: this.isRunning,
            messages: this.taskOutput, 
            metadata: this.stats
        });
        this.emitToSocket(this.socketId, 'job_complete', res);
    }
  }

    emitFailed(){
    if(this.socketId){
        let res = new FrontendMessageFormat({ 
            aiJobId: this.id, 
            status: this.status, 
            isRunning: this.isRunning,
            messages: this.taskOutput, 
            metadata: this.stats
        });
        this.emitToSocket(this.socketId, 'job_error', res);
    }
  }

  /**
   * Fetches all global and tool context (summarised to save tokens)
   * @returns {object} - { context : { globalData: {}, toolData: {} } }  
   */
  getAllContextSummaryString(){
    return JSON.stringify({ context: this.contextData.getAllContext() });
  }

    /**
    * Fetches all global and tool context (Full Values)
    * @returns {object} - { context : { globalData: {}, toolData: {} } }  
    */
  getAllContextRaw(){
    let toolData = this.messageHistory.getToolMessagesAsObject();
    let globalData = this.contextData.globalData;
    return { context: { globalData, toolData } };
  }

  /** Set status to complete and isRunning to false */
  setComplete(){ 
      this.isRunning = false;
      this.status.setComplete();
  }

  /** Set status to failed and isRunning to false */
  setFailed(){ 
      this.isRunning = false;
      this.status.setFailed();
  }

  setStartTime(){ 
      this.startEpochMs = Date.now();
  }

  setEndTime(){ 
      this.endEpochMs = Date.now();
  }

  /**
   * Adds to the aiCount in stats
   * @param {number} num - the number to add 
   * @returns {number} - the updated total
   */
  addAiCount(num) { 
    this.stats.aiCount += num;
    return this.stats.aiCount;
  }

  /**
   * Adds to the toolCout in stats
   * @param {number} num - the number to add 
   * @returns {number} - the updated total
   */
  addToolCount(num) { 
    this.stats.toolCount += num;
    return this.stats.toolCount
  }

  /**
   * Adds to the loopCount in stats
   * @param {number} num - the number to add 
   * @returns {number} - the updated total
   */
  addLoopCount(num){
    this.stats.loopNumber += num;
    return this.stats.loopNumber;
  }

  // Used to bulk import data to class (useful for passing between threads)
  import(data) {
    if (!data || typeof data !== 'object') return;
    // Iterate through the keys of the incoming object
    Object.keys(data).forEach(key => {
      // Only map if the property already exists in 'this'
      if (Object.prototype.hasOwnProperty.call(this, key)) {
        if(key == "status"){
            let st = new TaskStatus().importStatus(data[key]);
            this.status = st;
        } else if (key == "contextData"){
            let cd = new ContextTemplate().import(data[key]);
            this.contextData = cd;
        } else if (key == "messageHistory"){
            let msgs = Services.aiAgents.processApiMessagesToClasses(data[key].allMessages).value;
            let ml = new MessageLog();
            ml.allMessages = msgs;
            this.messageHistory = ml;
        } else if(key == "taskOutput"){
            let msgs = Services.aiAgents.processApiMessagesToClasses(data[key]).value;
            this.taskOutput = msgs;
        } else if(key == "socketId"){
            this.socketId = data[key];
        }
        else {
            this[key] = data[key];
        }
      }
    });
    return this;
  }
}

export const Status = {
    Complete: "Complete",
    Failed: "Failed",
    NotStarted: "Not Started",
    InProgress: "In Progress",
    MaxLoopsHit: "Max-Loops Hit",
    AwaitingUserInput: "Awaiting User Input",
    NewInfoAdded: "User has given more information",
    Stopped: "Stopped by user",
    Custom: "Custom Status"
}

export class TaskStatus {
    constructor() {
        this.taskStatus = Status.NotStarted;
        this.customText = null;
    }
    setComplete() {
        this.taskStatus = Status.Complete;
    }
    setFailed() {
        this.taskStatus = Status.Failed;
    }
    setMaxLoopsHit(){
        this.taskStatus = Status.MaxLoopsHit;
    }
    setInProgress(){
        this.taskStatus = Status.InProgress;
    }
    setAwaitingUserInput(){
        this.taskStatus = Status.AwaitingUserInput;
    }
    setCustomStatus(status){
        if(typeof status === "string"){
            this.taskStatus = Status.Custom;
            this.customText = status;
        }
    }
    setStoppedByUser(){
        this.taskStatus = Status.Stopped;
    }
    setNewInfoAdded(){
        this.taskStatus = Status.NewInfoAdded;
    }
    getStatus(){
        if(this.taskStatus == Status.Custom){
            return this.customText;
        } else {
            return this.taskStatus;
        }
    }

    //** Used for checking if current status == something. */
    isStatus(status){
        if(this.taskStatus == status){
            return true;
        } else {
            return false;
        }
    }

    // Useful when passing between threads.
    importStatus(status){
        switch (status.taskStatus) {
            case Status.Complete:
                this.setComplete()
            case Status.Failed:
                this.setFailed()
            case Status.NotStarted:
                this.taskStatus = Status.NotStarted;
            case Status.InProgress:
                this.setInProgress()
            case Status.MaxLoopsHit:
                this.setMaxLoopsHit()
            case Status.AwaitingUserInput:
                this.setAwaitingUserInput()
            case Status.NewInfoAdded:
                this.setNewInfoAdded()
            case Status.Stopped:
                this.setStoppedByUser()
            case Status.Custom:
                this.taskStatus = Status.Custom;
                this.customText = status.customText;
            default:
                this.taskStatus = Status.NotStarted;
        }
        return this;
    }
}

