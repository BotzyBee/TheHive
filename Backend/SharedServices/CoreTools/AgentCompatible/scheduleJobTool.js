/**
 * 🐝 TheHive Plugin Tool Standard - Schedule Job Tool
 */

export const details = {
    toolName: "scheduleJobTool",
    version: "0.1.0",
    creator: "Botzy Bee",
    overview: "Manages scheduled tasks within the system. Supports three modes: 1 (Schedule an AI call), 2 (Cancel a scheduled task by ID), and 3 (List all active tasks). Limitations: AI callbacks run in the background and their text results are outputted to system logs rather than returned immediately to the user.",
    guide: "Always invoke with an explicit 'mode'. For Mode 1, provide a unique timerName, aiComments, and scheduling timing (delayMs or date). For Mode 2, provide the timerID. For Mode 3, no additional parameters are required. When using mode 1 - you should only add intervalMs when the user specifically indicates they want a recurring or repeating task.",
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
                "description": "Mode 1: The delay in milliseconds before the first execution."
            },
            "date": {
                "type": "string",
                "description": "Mode 1: A specific Date/Time for execution (ISO 8601 string)."
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
 * @param {object} Shared - Core Hive services
 * @param {object} params - Inputs defined in inputSchema
 * @returns {Promise<object>} Result wrapper containing operation metadata
 */
async function handleScheduleMode(Shared, params) {
    const { timerName, delayMs, date, intervalMs, aiComments } = params;

    if (!timerName) {
        return Shared.Utils.Err("Mode 1 requires 'timerName' to uniquely identify the schedule.");
    }
    if (!aiComments) {
        return Shared.Utils.Err("Mode 1 requires 'aiComments' defining the AI instructions.");
    }

    let delay = delayMs || 0;
    if (date) {
        const parsedDate = new Date(date);
        if (!isNaN(parsedDate.getTime())) {
            delay = parsedDate;
        }
    }

    const isOneOff = !intervalMs || intervalMs <= 0;

    // AI Execution Callback
    const callbackFn = async () => {
        await Shared.Utils.createNewTaskAgentJob(aiComments);
    };

    const config = {
        delay,
        intervalMs: intervalMs || 0,
        isOneOff
    };

    const timerResult = Shared.CoreTools.Timers.addNewTimer(timerName, callbackFn, config);
    
    if (timerResult.isErr()) {
        return Shared.Utils.Err(`Failed to create schedule: ${timerResult.value}`);
    }

    return Shared.Utils.Ok(JSON.stringify({
        action: "scheduled",
        timerName,
        isOneOff,
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
    
    if (!timerID && !timerName) {
        return Shared.Utils.Err("Mode 2 requires 'timerID' (or 'timerName' as fallback) to cancel a task.");
    }

    const cancelResult = Shared.CoreTools.Timers.removeTimer(timerName, timerID);
    
    if (cancelResult.isErr()) {
        return Shared.Utils.Err(`Failed to cancel task: ${cancelResult.value}`);
    }

    return Shared.Utils.Ok(JSON.stringify({
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
    const listResult = Shared.CoreTools.Timers.getAllTimersAsString();
    
    if (listResult.isErr()) {
        return Shared.Utils.Err(`Failed to list tasks: ${listResult.value}`);
    }

    return Shared.Utils.Ok(JSON.stringify({
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
            return Shared.Utils.Err(`Error (scheduleJobTool) : Invalid mode '${mode}'. Supported modes are 1, 2, or 3.`);
    }

    // Catch errors bubbling up from specific mode handlers
    if (operationResult.isErr()) {
        return operationResult; 
    }

    // Construct response standardized across all modes
    let instructions = mode === 1 ? "AI task has been scheduled as requested." : 
                        mode === 2 ? "Scheduled task cancellation has been completed." : 
                        "Active timers retrieved successfully.";
    const message = new Shared.Classes.TextMessage({
        role: Shared.Classes.Roles.Tool,
        textData: operationResult.value,
        toolName: details.toolName,
        instructions: instructions
    });
    return Shared.Utils.Ok([message]);
}
