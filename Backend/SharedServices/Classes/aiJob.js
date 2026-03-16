import { generateLongID } from "../Utils/index.js";
import { MessageLog } from "./aiMessages.js";
import { ContextTemplate } from "./context.js";
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
}

// Base Class for all AI Jobs / Agents 
export class AiJob {
  constructor({ idPrefix = "AI", aiSettings } = {}){ 
    /**@type {string} */
    this.id = generateLongID(idPrefix);

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
  run() {
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
}