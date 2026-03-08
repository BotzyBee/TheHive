import* as su from '../SharedServices/Utils/index.js';
import * as db from '../SharedServices/Database/index.js';

// [][] -- Change Job - Used to update DB with file/ Dir changes -- [][]
export class indexJob {
  constructor(url) {
    this.url = url; // URLs should only use forward-slashes /
    this.attemptNumber = 0;
    this.errorThrown = false;
    this.errorText = [];
  }

  async addFileToDB(dbAgent, dirRef, fileType, updateMillis, metaObj) {
    let res = await db.addFileToDB(
      dbAgent,
      dirRef,
      this.url,
      fileType,
      updateMillis,
      metaObj
    );
    if (res.isErr()) {
      su.log(`Error indexJob (addFileToDB) : 
                attempt: ${this.attemptNumber}
                url: ${this.url} 
                error text : ${res.value}`);
      this.attemptNumber += 1;
      this.errorThrown = true;
      this.errorText.push(res.value);
      this.jobType = 'addFile';
    }
    return this; // return this for chaining calls.
  }

  async addDirToDB(dbAgent, parentDirRef, updateMillis, metaObj) {
    let res = await db.addDirectoryToDB(
      dbAgent,
      this.url,
      parentDirRef,
      updateMillis,
      metaObj
    );
    if (res.isErr()) {
      su.log(`Error indexJob (addDirToDB) : 
                attempt: ${this.attemptNumber}
                url: ${this.url} 
                error text : ${res.value}`);
      this.attemptNumber += 1;
      this.errorThrown = true;
      this.errorText.push(res.value);
    }
    return this; // return this for chaining calls.
  }

  async updateDbFile(dbAgent, updateData) {
    // upadate data = object of keys/ values to be updated
    // eg {LastUpdate: 123, Meta: { tags: ["cheese", "potato"] } }
    let res = await db.updateRecords(
      dbAgent,
      fileTableName,
      'Url',
      this.url,
      updateData
    );
    if (res.isErr()) {
      this.attemptNumber += 1;
      su.log(`Error indexJob (updateDbFile -> updateRecords) : 
                attempt: ${this.attemptNumber}
                url: ${this.url} 
                error text : ${res.value}`);
      this.errorThrown = true;
      this.errorText.push(res.value);
    }
    return this; // return this for chaining calls.
  }

  async updateDbDir(dbAgent, updateData) {
    // upadate data = object of keys/ values to be updated
    // eg {LastUpdate: 123, Meta: { tags: ["cheese", "potato"] } }
    let res = await db.updateRecords(
      dbAgent,
      dirTableName,
      'Url',
      this.url,
      updateData
    );
    if (res.isErr()) {
      this.attemptNumber += 1;
      su.log(`Error indexJob (updateDbDir -> updateRecords) : 
                attempt: ${this.attemptNumber}
                url: ${this.url} 
                error text : ${res.value}`);
      this.errorThrown = true;
      this.errorText.push(res.value);
    }
    return this; // return this for chaining calls.
  }

  async removeFileFromDB(dbAgent) {
    let res = await db.deleteRecordsByField(
      dbAgent,
      fileTableName,
      'Url',
      this.url
    );
    if (res.isErr()) {
      this.attemptNumber += 1;
      su.log(`Error indexJob (removeFileFromDB -> deleteRecordsByField) : 
                attempt: ${this.attemptNumber}
                url: ${this.url} 
                error text : ${res.value}`);
      this.errorThrown = true;
      this.errorText.push(res.value);
    }
    return this; // return this for chaining calls.
  }

  async removeDirFromDB(dbAgent) {
    // Get any sub-dirs or sub-files which also should be removed
    let allSubs = await db.getDirsAndFilesRecursive(dbAgent, this.url);
    if (allSubs.isErr()) {
      this.attemptNumber += 1;
      su.log(`Error indexJob (removeDirFromDB -> getDirsAndFilesRecursive) : 
                attempt: ${this.attemptNumber}
                url: ${this.url} 
                error text : ${allSubs.value}`);
      this.errorThrown = true;
      this.errorText.push(allSubs.value);
    }
    let i;
    const allDirsLen = allSubs.value.directoryList.length ?? 0;
    const allFileLen = allSubs.value.fileList.length ?? 0;
    // iterate over Dirs
    for (i = 0; i < allDirsLen; i++) {
      let allDirRes = await db.deleteRecordsByField(
        dbAgent,
        dirTableName,
        'Url',
        allSubs.value.directoryList[i].Url
      );
      if (allDirRes.isErr()) {
        this.attemptNumber += 1;
        su.log(`Error indexJob (removeDirFromDB -> deleteRecordsByField ${i}) : 
                    attempt: ${this.attemptNumber}
                    url: ${this.url} 
                    error text : ${allDirRes.value}`);
        this.errorThrown = true;
        this.errorText.push(allDirRes.value);
      }
    }

    // iterate over Files
    for (i = 0; i < allFileLen; i++) {
      let allFileRes = await db.deleteRecordsByField(
        dbAgent,
        fileTableName,
        'Url',
        allSubs.value.fileList[i].Url
      );
      if (allFileRes.isErr()) {
        this.attemptNumber += 1;
        su.log(`Error indexJob (removeDirFromDB -> deleteRecordsByField(2) ${i}) : 
                    attempt: ${this.attemptNumber}
                    url: ${this.url} 
                    error text : ${allFileRes.value}`);
        this.errorThrown = true;
        this.errorText.push(allFileRes.value);
      }
    }

    // Delete Root Dir
    let res = await db.deleteRecordsByField(
      dbAgent,
      dirTableName,
      'Url',
      this.url
    );
    if (res.isErr()) {
      this.attemptNumber += 1;
      su.log(`Error indexJob (removeDirFromDB -> deleteRecordsByField) : 
                attempt: ${this.attemptNumber}
                url: ${this.url} 
                error text : ${res.value}`);
      this.errorThrown = true;
      this.errorText.push(res.value);
    }
    return this; // return this for chaining calls.
  }
}

// [][] ------------------------------------------ [][]
// [][] -- Base constants / classes for AI Jobs -- [][]
// [][] ------------------------------------------ [][]
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
}

export class ChatLog {
  #messageCount;
    constructor() {
      this.#messageCount = 0;
      this.allMessages = [];
  }

  /**
   * Adds user message to chat log
   * @param {any} message - can be text, object or other data 
   */
  addUserMessage(message){
    this.allMessages.push({source: 'user', data: message});
    this.#messageCount += 1;
  }

   /**
   * Adds agent message to chat log
   * @param {any} message - can be text, object or other data 
   */
  addAgentMessage(message){
    this.allMessages.push({source: 'agent', data: message});
    this.#messageCount += 1;
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
}

// Base Class for all AI Jobs / Agents 
export class AiJob {
  constructor({ idPrefix = "AI", } = {}){ 
    /**@type {string} */
    this.id = su.generateLongID(idPrefix);

    /**@type {TaskStatus} */
    this.status = new TaskStatus();

    /**@type {object} - Default is {}*/
    this.contextData = {};

    /**@type {object} - Optional settings passed to aiCall eg. provider, quality */
    this.aiSettings = {}

    /**@type {any} - The final return from any AiJob. Default is null */
    this.taskOutput = null;

    /**@type {number} - The start time (epoch) when the Job was started */
    this.startEpochMs = 0;

    /**@type {number} - The end time (epoch) when the Job was fully completed/ stopped */
    this.endEpochMs = 0;

    /**@type {array[string]} - Array of errors for debugging. */
    this.errors = [];

    /**@type {ChatLog} - Chat log class for holding and managing user & agent messages */
    this.conversationHistory = new ChatLog();

    /**@type {boolean} - true if job is actively being worked on. */
    this.isRunning = false;

    /**@type {object} -  { toolCount: 0, aiCount: 0, loopNumber: 0, custom: {} }*/
    this.stats = { toolCount: 0, aiCount: 0, loopNumber: 0, custom: {} }
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
}

// // Extending AiJob - Example
// class ResearchAgent extends AiJob {
//   constructor(){
//     super() // <== anything put in super(here) will be passed to the parent constructor
//   }
//   searchAcademicPapers(topic) {
//     this.id // <== inherets the value from parent. 
//     super().addLoopCount(1) // <== can call a method on the parent.
//     return `Searching papers about ${topic}...`;
//   }
// }


