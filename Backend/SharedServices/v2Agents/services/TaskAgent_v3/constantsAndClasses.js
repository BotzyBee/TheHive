import { Services } from '../../../index.js';

// For managing the flow of the Task Agent
export const TaskFlow = {
    Loading: {
        main: "Loading::main", // using main as default is a reserved word.
    },
    Plan: {
        createPlan: "Plan::createPlan",
        rePlan: "Plan::rePlanning",
    },
    Action: {
        callTool: "Action::callAgentTool",
        messageUser: "Action::messageUser"
    },
    Review: {
        newMessage: "Review::newMessageFromUser",
        toolOutput: "Review::toolOutput",
        processContext: "Review::contextProcessing"
    },
    Stopped: {
        Failed: "Stopped::failed",
        AwaitUser: "Stopped::awaitingUser",
        Stopped: "Stopped:stoppedByUser",
        FinalOutput: "Stopped::draftingFinalOutput",
        Complete: "Stopped::complete"
    },
    Healing: {
        main: "Healing::main" // using main as default is a reserved word.
    }
}

// Individual actions that make up the 'PLAN'. 
// Note the id created here is used throughout the TaskAgent to link input actions with output data. 
export class TaskAction {
    constructor(action, tool) {
        this.id = Services.v2Core.Utils.generateShortID("ACT");
        /** The action to be completed */
        this.action = action;
        /** The tool to be used */
        this.tool = tool;
        this.complete = false;
        this.attempt = 0;
    }
    addAttempt(){
        this.attempt += 1;
    }
    setComplete(){
        this.complete = true;
    }
}