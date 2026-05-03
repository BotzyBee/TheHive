import path from 'path';
import { Services } from '../../../index.js';
import { AiJob } from '../../core/classes.js';
import { TaskFlow } from './constantsAndClasses.js';
import {
  loadingMain,
  createPlan,
  performNextAction,
  messageUser,
  reviewUserMessage,
  reviewToolOutput,
  processFinalOutput,
  healing,
} from './functions.js';

export class TaskAgent extends AiJob {
  constructor({
    task = '',
    aiSettings = {},
    toolRetryCount = 1,
    maxLoopBuffer = 20,
    summaryDataSizeThreshold = 500,
    socketId = null,
    emitFunction = null,
    whoGetsUpdates = null,
    skipReviewTools,
    callFactory = null,
  } = {}) {
    super({ aiSettings, socketId, emitFunction, whoGetsUpdates, callFactory }); // setup parent class
    this.messageHistory.addMessage(
      new Services.aiAgents.Classes.TextMessage({
        role: Services.aiAgents.Constants.Roles.User,
        textData: task,
      })
    );
    this.task = task;
    this.agentType = 'TaskAgent';

    // Additional Tool Vars
    this.toolRetryCount = toolRetryCount; // how many times to try a tool.

    // Workflow
    this.plan = []; // array of TaskAction class objects
    this.TaskState = {
      currentFlowState: TaskFlow.Loading.main,
      stateHistory: [],
      handoverMessage: '',
      handoverData: [],
    };
    this.maxLoopBuffer = maxLoopBuffer; // Gives the agent X number of extra loops to ask questions/ attempt fixes etc.
    this.maxLoops = 10; // this is updated when a plan is created.
    this.summaryDataSizeThreshold = summaryDataSizeThreshold; // How many characters before context summarisation
    this.debugParams = []; // used to store params crafted for tools for debugging and improvement purposes.
    this.skipReviewTools = skipReviewTools || [
      'createCodeTool',
      'deepResearchTool',
      'superWriterTool',
      'rePlanTool',
      'returnToUser',
    ]; // Outputs from these tools aren't critiqued (they have their own QA process!)
    this.healPrompt = '';
  }

  // [][] -- HELPER FUNCTIONS -- [][]
  getNextAction() {
    let actionLen = this.plan.length ?? 0;
    for (let i = 0; i < actionLen; i++) {
      if (this.plan[i]?.complete == false) {
        return this.plan[i];
      }
    }
    return null;
  }
  updateAction(actionID, actionText, tool) {
    let actionLen = this.plan.length ?? 0;
    for (let i = 0; i < actionLen; i++) {
      if (this.plan[i]?.id == actionID) {
        if (actionText) this.plan[i].action = actionText;
        if (tool) this.plan[i].tool = tool;
      }
    }
    return null;
  }
  incrimentActionCount(actionID) {
    const actionToUpdate = this.plan.find((act) => act.id === actionID);
    if (actionToUpdate) {
      actionToUpdate.attempt += 1;
    }
  }
  setActionComplete(actionID) {
    const actionToUpdate = this.plan.find((act) => act.id === actionID);
    if (actionToUpdate) {
      actionToUpdate.complete = true;
    }
  }
  setActionText(actionID, actionText) {
    if (actionID && typeof actionText == 'string') {
      const actionToUpdate = this.plan.find((act) => act.id === actionID);
      if (actionToUpdate) {
        actionToUpdate.action = actionText;
      }
    }
  }
  fetchAction(actionID) {
    const action = this.plan.find((act) => act.id === actionID);
    if (action) {
      return action;
    }
    return null;
  }
  setFlowState(state) {
    console.log(' \n *** FLOW *** -> ', state);
    this.TaskState.currentFlowState = state;
    this.TaskState.stateHistory.push(state);
  }
  getOustandingActionCount() {
    let outstandingActions = this.plan.filter(
      (item) => item.complete === false
    );
    let count = outstandingActions.length ?? 0;
    return count;
  }

  getSummaryContextByActionID(actionID) {
    return Object.fromEntries(
      Object.entries(this.contextData.toolData).filter(([key, value]) => {
        return value.metadata?.actionID === actionID;
      })
    );
  }
  /**
   * Generate text using AI - With auto retry.
   * @param {*} systemMessage
   * @param {*} userMessage
   * @param {object} [options]
   * @param {string} [options.model]           - Exact model string (optional)
   * @param {string} [options.provider]        - AiProviders value (optional)
   * @param {number} [options.quality]         - AiQuality value (optional)
   * @param {object} [options.structuredOutput]  - If set, returns parsed JSON; (auto-filters structuredOutputs)
   * @param {bool}   [options.randomModel]       - If true a random model fitting the requirements will be chosen.
   * @returns {Result} - Result ( object | string ) - depending if structured OP or not.
   */
  async generateText(systemMessage, userMessage, options = this.aiSettings) {
    let call;
    for (let i = 0; i < this.toolRetryCount; i++) {
      call = await this.aiCall.generateText(
        systemMessage,
        userMessage,
        options
      );
      this.addAiCount(1);
      if (call.isOk()) return call; // already has result
    }
    const errorMsg = `Error ( TaskAgent - #generateText ) : ${JSON.stringify(call.value, null, 2)}`;
    this.errors.push(errorMsg);
    return Services.v2Core.Helpers.Err(errorMsg);
  }

  // used in planning function
  async getSuitableGuides(task, maxGuides = 10) {
    // Get guides by vector lookup
    let matchingGuides =
      await Services.database.Helpers.getToolsOrGuidesForTask(
        task,
        maxGuides,
        false
      ); // false = search guides not tools
    if (matchingGuides.isErr()) {
      return Services.v2Core.Helpers.Err(
        `Erorr (getSuitableGuides -> getToolsOrGuidesForTask) : ${JSON.stringify(matchingGuides.value, null, 2)}`
      );
    }
    // Use AI to select the most suitable
    let call = await this.generateText(
      'Your task is to review the provided guide text and return the file path for any guides that could be useful for the user task. ' +
        'If none are relevant return an empty array. This is better than adding irrelevant guides to the plan. ',
      `Here is the user task : ${task} and here are the guides : ${JSON.stringify(matchingGuides.value)}`,
      {
        ...this.aiSettings,
        structuredOutput: {
          type: 'object',
          description:
            'An object containing a filePaths property which is an array of string values.',
          properties: {
            filePaths: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
          },
          required: ['filePaths'],
        },
      }
    );
    if (call.isErr()) {
      return Services.v2Core.Helpers.Err(
        `Error (getSuitableGuides -> generateText ) : ${JSON.stringify(call.value, null, 2)}`
      );
    }
    // fetch the texts
    let OPlen = call.value.filePaths.length ?? 0;
    let OPAR = [];
    for (let i = 0; i < OPlen; i++) {
      const readFile = await Services.fileSystem.CRUD.readFileContent(
        call.value.filePaths[i]
      );
      if (readFile.isErr()) {
        return readFile;
      }
      OPAR.push(readFile.value);
    }
    console.log(`${OPAR.length} Guides have been added to planing process.`);
    OPAR.join('\n Next Guide : \n\n');
    return Services.v2Core.Helpers.Ok(OPAR);
  }

  // used in planning function
  getCompletedActionsSummary() {
    const completed = this.plan.filter((item) => item.complete);
    if (!completed.length) return 'No prior actions have been completed.';
    return (
      'The following actions have been completed:\n' +
      completed.map((item, i) => `${i + 1}. ${item.action}`).join('\n')
    );
  }

  /**
   * Processes tool outputs into a summary & full outputs
   * @param {array} toolOutputArray - Array of aiMessage types
   * @return {Result} - Result({ summaryObj: summary data object, rawDataMessage: DataMessage (full tool output) })
   */
  async processToolOutput(toolOutputArray) {
    // Process messages from tool call
    let newMessageLen = toolOutputArray.length ?? 0;
    let summary = {};
    const toolNm = toolOutputArray[0].toolName || '';
    for (let i = 0; i < newMessageLen; i++) {
      // Shorten & add to context
      if (toolOutputArray[i].role === Services.aiAgents.Constants.Roles.Tool) {
        this.emitUpdateStatus(
          `Processing Tool Message: ${i + 1} of ${newMessageLen}`
        );
        let processed =
          await Services.aiAgents.AgentSharedServices.processMessageForContext(
            toolOutputArray[i],
            this.summaryDataSizeThreshold,
            this.aiSettings,
            this
          );
        if (processed.isErr()) {
          return Services.v2Core.Helpers.Err(
            `Error : ( processToolOutput ) : ${processed.value}`
          );
        }
        // Add data to tool context;
        let k = processed.value.key;
        summary[`${k}`] = processed.value[`${k}`];
      }
    }
    return Services.v2Core.Helpers.Ok({
      summaryObj: summary,
      rawMessages: toolOutputArray,
    });
  }

  // [][] --- MAIN ENTRY POINT --- [][]
  async run() {
    try {
      console.log('Starting Task Agent Job');
      // Start / Re-start the agent
      this.isRunning = true;
      this.taskOutput = [];
      if (this.startEpochMs == 0) this.setStartTime();

      // Main Loop
      while (this.isRunning == true) {
        switch (this.TaskState.currentFlowState) {
          // [][] -- LOADING ACTIONS -- [][]
          case TaskFlow.Loading.main:
            await loadingMain(this);
            break;

          // [][] -- PLANNING ACTIONS -- [][]
          case TaskFlow.Plan.createPlan:
          case TaskFlow.Plan.rePlan:
            await createPlan(this);
            break;

          // [][] -- AGENT ACTIONS -- [][]
          case TaskFlow.Action.callTool:
            await performNextAction(this);
            break;

          // [][] -- REVIEW ACTIONS -- [][]
          case TaskFlow.Review.newMessage:
            await reviewUserMessage(this);
            break;
          case TaskFlow.Review.toolOutput:
          case TaskFlow.Review.processContext:
            await reviewToolOutput(this);
            break;

          case TaskFlow.Action.messageUser:
            await messageUser(this);
            break;

          // [][] -- STOPPED STATES -- [][]
          case TaskFlow.Stopped.Failed:
            this.isRunning = false;
            const targetDirectoryInContainer1 = path.join(
              Services.fileSystem.Constants.containerVolumeRoot,
              'UserFiles/BotzysFiles/FailedJobs/'
            );
            await Services.fileSystem.CRUD.saveFile(
              targetDirectoryInContainer1,
              JSON.stringify(this, null, 2),
              `${this.id}_Failed.txt`
            );
            this.emitFailed();
            break;
          case TaskFlow.Stopped.AwaitUser:
          case TaskFlow.Stopped.Stopped:
            this.isRunning = false;
            await endActions(this);
            return Services.v2Core.Helpers.Ok('Task Agent Has Stopped');
          case TaskFlow.Stopped.FinalOutput:
            this.emitUpdateStatus('Creating Final Output...');
            await processFinalOutput(this);
            break;
          case TaskFlow.Stopped.Complete:
            this.isRunning = false;
            this.emitFinalResult();
            await endActions(this);
            return Services.v2Core.Helpers.Ok('Task Agent Run Complete');

          // [][] -- HEALING / FIXES -- [][]
          case TaskFlow.Healing.main:
            await healing(this);
            break;

          case undefined:
            console.log("DANG.. it's gone and broken!");
            const targetDirectoryInContainer = path.join(
              Services.fileSystem.Constants.containerVolumeRoot,
              'UserFiles/BotzysFiles/FailedJobs/'
            );
            await Services.fileSystem.CRUD.saveFile(
              targetDirectoryInContainer,
              JSON.stringify(this, null, 2),
              `${this.id}_Failed.txt`
            );
            return;
        } // end switch

        // catch max loops
        if (this.stats.loopNumber >= this.maxLoops) {
          this.isRunning = false;
          let e = `Error: Maximum loop count of ${this.maxLoops} exceeded.`;
          this.emitUpdateStatus('Failed : Max Loops Hit! ➿');
          this.errors.push(e);
          console.log(e);
          this.status.setMaxLoopsHit();
          this.emitFailed();
          await endActions(this);
          return Services.v2Core.Helpers.Err(`Error (Task Agent) : ${e}`);
        }
        this.addLoopCount(1);
      } // end loop
    } catch (error) {
      console.log('MAJOR ERROR :: ', error);
    }

    return Services.v2Core.Helpers.Ok('Task Agent Run Complete');
  } // end run
} // end Task Agent

async function endActions(agentObject) {
  agentObject.setEndTime();
  agentObject.debugParams = [];
  const targetDirectoryInContainer = path.join(
    Services.fileSystem.Constants.containerVolumeRoot,
    'UserFiles/BotzysFiles/TestJobs/'
  );
  await Services.fileSystem.CRUD.saveFile(
    targetDirectoryInContainer,
    JSON.stringify(agentObject, null, 2),
    `${agentObject.id}.txt`
  );
}
