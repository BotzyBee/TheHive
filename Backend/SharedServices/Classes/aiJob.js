import { generateLongID } from "../Utils/index.js";
import { MessageLog } from "./aiMessages.js";

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

// Base Class for all AI Jobs / Agents 
export class AiJob {
  constructor({ idPrefix = "AI", } = {}){ 
    /**@type {string} */
    this.id = generateLongID(idPrefix);

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

    /**@type {MessaageLog} - Chat log class for holding and managing user & agent messages */
    this.conversationHistory = new MessageLog();

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