/**
 * 🐝 TheHive Plugin Tool Standard - Schedule Job Tool
 */

export const details = {
    toolName: "scheduleJobTool",
    version: "0.2.1",
    creator: "Botzy Bee",
    overview: "Manages scheduled tasks within the system. Supports three modes: 1 (Schedule an AI call), 2 (Cancel a scheduled task by ID), and 3 (List all active tasks). Limitations: AI callbacks run in the background and their text results are outputted to system logs rather than returned immediately to the user.",
    guide: "Always invoke with an explicit 'mode'. For Mode 1, provide a unique timerName, aiComments, and scheduling timing. If the user specifies a relative time ('in 5 minutes'), use 'delayMs'. If the user specifies an absolute time ('at 21:00 on 15/10/24'), calculate and provide the exact ISO 8601 string for 'targetTime'. For Mode 2, provide the timerID. For Mode 3, no additional parameters are required. Add 'intervalMs' only if a recurring task is requested.",
    inputSchema: JSON.stringify({
        "type": "object",
        "properties": {
            "mode": {
                "type": "integer",
                "description": "Operational mode: 1 = Schedule an AI call, 2 = Cancel a task, 3 = List all timers.",
                "enum": [1, 2, 3]
            },
            "timerName": {
                "type": "string",
                "description": "Mode 1: A unique identifier name for the new timer."
            },
            "delayMs": {
                "type": "integer",
                "description": "Mode 1: The delay in milliseconds before the first execution (for relative times)."
            },
            "targetTime": {
                "type": "string",
                "description": "Mode 1: A specific Date/Time for execution (ISO 8601 string, for absolute times)."
            },
            "intervalMs": {
                "type": "integer",
                "description": "Mode 1: Optional repeat interval in milliseconds. If omitted, the task runs only once."
            },
            "aiComments": {
                "type": "string",
                "description": "Mode 1: The task description or instructions for the AI to execute."
            },
            "timerID": {
                "type": "string",
                "description": "Mode 2: The unique ID of the timer to cancel."
            }
        },
        "required": ["mode"],
        "additionalProperties": false
    })
};

/**
 * Handles Mode 1: Scheduling an AI call
 * @param {object} Shared - Core Hive services (Must include Shared.dateFns)
 * @param {object} params - Inputs defined in inputSchema
 * @returns {Promise<object>} Result wrapper containing operation metadata
 */
async function handleScheduleMode(Shared, params) {
    const { timerName, delayMs, targetTime, intervalMs, aiComments } = params;

    if (!timerName) {
        return Shared.v2Core.Helpers.Err("Mode 1 requires 'timerName' to uniquely identify the schedule.");
    }
    if (!aiComments) {
        return Shared.v2Core.Helpers.Err("Mode 1 requires 'aiComments' defining the AI instructions.");
    }

    let calculatedDelay = 0;
    
    if (targetTime) {
        const parsedDate = Shared.aiAgents.ToolHelpers.parseISOHelper(targetTime);
        
        if (!Shared.aiAgents.ToolHelpers.isValidHelper(parsedDate)) {
            return Shared.v2Core.Helpers.Err(`Invalid targetTime format provided: ${targetTime}. Must be a valid ISO 8601 string.`);
        }

        // Calculate milliseconds between now and the target date
        const now = new Date(); 
        calculatedDelay = Shared.aiAgents.ToolHelpers.differenceInMillisecondsHelper(parsedDate, now);

        if (calculatedDelay < 0) {
            return Shared.v2Core.Helpers.Err("Cannot schedule a task in the past.");
        }
    } else if (delayMs !== undefined) {
        calculatedDelay = Math.max(0, delayMs); // Ensure we don't get negative delays
    }

    const isOneOff = !intervalMs || intervalMs <= 0;

    // AI Execution Callback
    const callbackFn = async () => {
        await Shared.aiAgents.ToolHelpers.createNewTaskAgentJob(aiComments);
    };

    const config = {
        delay: calculatedDelay,
        intervalMs: intervalMs || 0,
        isOneOff
    };

    const timerResult = Shared.v2Core.Timers.addNewTimer(timerName, callbackFn, config);
    
    if (timerResult.isErr()) {
        return Shared.v2Core.Helpers.Err(`Failed to create schedule: ${timerResult.value}`);
    }

    return Shared.v2Core.Helpers.Ok(JSON.stringify({
        action: "scheduled",
        timerName,
        isOneOff,
        delayMsUsed: calculatedDelay,
        status: "success"
    }));
}

/**
 * Handles Mode 2: Canceling a scheduled task
 * @param {object} Shared - Core Hive services
 * @param {object} params - Inputs defined in inputSchema
 * @returns {Promise<object>} Result wrapper containing operation metadata
 */
async function handleCancelMode(Shared, params) {
    const { timerID, timerName } = params;
    console.log(`Attempting to cancel timer with ID: ${timerID} or Name: ${timerName}`);
    
    const cancelResult = Shared.v2Core.Timers.removeTimer(timerName, timerID);
    
    if (cancelResult.isErr()) {
        return Shared.v2Core.Helpers.Err(`Failed to cancel task: ${cancelResult.value}`);
    }

    return Shared.v2Core.Helpers.Ok(JSON.stringify({
        action: "cancelled",
        target: timerID || timerName,
        details: cancelResult.value,
        status: "success"
    }));
}

/**
 * Handles Mode 3: Listing all active timers
 * @param {object} Shared - Core Hive services
 * @returns {Promise<object>} Result wrapper containing operation metadata
 */
async function handleListMode(Shared) {
    const listResult = Shared.v2Core.Timers.getAllTimersAsString();
    
    if (listResult.isErr()) {
        return Shared.v2Core.Helpers.Err(`Failed to list tasks: ${listResult.value}`);
    }

    return Shared.v2Core.Helpers.Ok(JSON.stringify({
        action: "list",
        timers: listResult.value,
        status: "success"
    }));
}

/**
 * Core Tool Executor
 * @param {object} Shared - Core Hive services
 * @param {object} params - Inputs defined in inputSchema
 * @returns {Promise<Result[DataMessage[]]>}
 */
export async function run(Shared, params = {}) {
    const { mode } = params;
    let operationResult;

    switch (mode) {
        case 1:
            operationResult = await handleScheduleMode(Shared, params);
            break;
        case 2:
            operationResult = await handleCancelMode(Shared, params);
            break;
        case 3:
            operationResult = await handleListMode(Shared);
            break;
        default:
            return Shared.v2Core.Helpers.Err(`Error (scheduleJobTool) : Invalid mode '${mode}'. Supported modes are 1, 2, or 3.`);
    }

    // Catch errors bubbling up from specific mode handlers
    if (operationResult.isErr()) {
        return operationResult; 
    }

    // Construct response standardized across all modes
    let instructions = mode === 1 ? "AI task has been scheduled as requested." : 
                       mode === 2 ? "Scheduled task cancellation has been completed." : 
                       "Active timers retrieved successfully.";
    
    const message = new Shared.aiAgents.Classes.TextMessage({
        role: Shared.aiAgents.Constants.Roles.Tool,
        textData: operationResult.value,
        toolName: details.toolName,
        instructions: instructions
    });
    return Shared.v2Core.Helpers.Ok([message]);
}