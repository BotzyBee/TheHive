import { generateLongID } from "../Utils/index.js";
import { MessageLog } from "./aiMessages.js";
import { ContextTemplate } from "./context.js";
import { processApiMessagesToClasses } from "../../Engine/routes/index.js";
import { Err } from "../Utils/index.js";

// [][] ------------------------------------------ [][]
// [][] -- Base constants / classes for AI Jobs -- [][]
// [][] ------------------------------------------ [][]

/*
* NOTE - Context handling. All messages (text, image, data, audio etc) are added to the message history.
* Summerised versions of tool output is added to toolContext - for planning. 
*/


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

// Base Class for all AI Jobs / Agents 
export class AiJob {
  constructor({ idPrefix = "AI", aiSettings } = {}){ 
    /**@type {string} */
    this.id = generateLongID(idPrefix);

    /**@type {string} - used to differentiate between base class and classes that extend AiJob*/
    this.agentType = "AiJob";

    /**@type {string}  - for managing the overall user task. */
    this.task = "";

    /**@type {TaskStatus} */
    this.status = new TaskStatus();

    /**@type {ContextTemplate} - Global and Summary Tool Data */
    this.contextData = new ContextTemplate();

    /**@type {object} - Optional settings passed to aiCall eg. provider, quality */
    this.aiSettings = aiSettings || {}

    /**@type {[]TextMessage | ImageMessage | AudioMessage | DataMessage } - The final return from any AiJob. This will be one or more 'messsages'. */
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
    return Err("Method 'run()' must be implemented in the subclass");
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
            let msgs = processApiMessagesToClasses(data[key].allMessages).value;
            let ml = new MessageLog();
            ml.allMessages = msgs;
            this.messageHistory = ml;
        } else if(key == "taskOutput"){
            let msgs = processApiMessagesToClasses(data[key]).value;
            this.taskOutput = msgs;
        }
        else {
            this[key] = data[key];
        }
      }
    });
    return this;
  }
}