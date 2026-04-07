import { initWebDriver, getCurrentPageContent  } from "./socket.js";
import { Ok, Err } from '../../Utils/helperFunctions.js';
import { connectedSockets } from "../../../app.js";
import { Services } from '../../index.js';
import { cleanHtmlString, smartExtractData } from './utils.js';
import { JobState } from "@google/genai";

let maxLoops = 3;
export let rustActionState = {
  result: null
};
let extractedData = [];

export async function testDrive(task, webUrl){
    let jobID = "test-job-123";

    let agent = new Services.AiCall.AiCall();
    let socket = connectedSockets[0];
    if(!socket){ return Err("No connected sockets available for WebDriver communication.") }

    // Example usage: Initialize WebDriver with a URL and job ID
    let initResult = await initWebDriver(socket, webUrl, jobID);
    if(initResult.isErr()){
        console.error(initResult.value);
        return Err(`WebDriver initialisation failed: ${initResult.value}`);
    }
    let completedActions = [];
    
    for(let i=0; i<maxLoops; i++){
        let contentResult = await getCurrentPageContent(socket, jobID);
        if(contentResult.isErr()){
            console.error(contentResult.value);
            return Err(`Failed to get page content: ${contentResult.value}`);
        }

        // Strip Script / Style tags from the content before saving, also strip style="" inline
        const cleanedResult = await cleanHtmlString(contentResult.value.data);
        if(cleanedResult.isErr()){
            console.error(cleanedResult.value);
            return Err(`Failed to clean HTML content: ${cleanedResult.value}`);
        }
        const strippedContent = cleanedResult.value;

        // SAVE FILE - TEMPORARY - REMOVE LATER
        const containerVolumeRoot = Services.Constants.containerVolumeRoot; 
        const targetDirectoryInContainer = Services.Utils.pathHelper.join(containerVolumeRoot, 'UserFiles/WebAgent/');
        Services.FileSystem.saveFile(targetDirectoryInContainer, JSON.stringify(strippedContent, null, 2), `WebAgent_${Date.now()}.txt`);
        
        // TASK REVIEW AND ROUTING 
        // Decide whether to extract data from the current page and whether the task is complete based on the current page content and task progress.
        let call1 = await agent.generateText(
            PromptsAndSchemas.reviewTask.sys,
            PromptsAndSchemas.reviewTask.usr(task, JSON.stringify(completedActions), strippedContent),
            { structuredOutput: PromptsAndSchemas.reviewTask.schema }
        );
        if(call1.isErr()){
            console.error(call1.value);
            return Err(`AI call failed: ${call1.value}`);
        }
        if(call1.value.action === "task_complete"){
            console.log("Task is complete! Ending loop.");
            break;
        }
        if(call1.value.action.includes("extract")){
            console.log("Task requires data extraction. Extract Prompt:", call1.value.extractPrompt);   
            let extractedDataResult = await smartExtractData(strippedContent, call1.value.extractPrompt, agent);
            if(extractedDataResult.isErr()){
                console.error(extractedDataResult.value);
                return Err(`Data extraction failed: ${extractedDataResult.value}`);
            }
            extractedData.push(extractedDataResult.value.extractedData);
            completedActions.push({ action_type: "Extract_Data_From_The_Webpage", extractedText: extractedDataResult.value.extractedData });
            if(call1.value.action === "extract_text_break"){
                console.log("Extraction indicates task is now complete. Ending loop.");
                break;
            }
        }

        // Generate webpage actions using the cleaned HTML content
        let call2 = await agent.generateText(
            PromptsAndSchemas.craftAction.sys,
            PromptsAndSchemas.craftAction.usr(task, JSON.stringify(completedActions), strippedContent),
            { structuredOutput: PromptsAndSchemas.craftAction.schema }
        );
        if(call2.isErr()){
            console.error(call2.value);
            return Err(`AI call failed: ${call2.value}`);
        }
        // sending actions to Rust WebDriver via socket
        let actions = call2.value.actions;
        console.log("Generated Actions:", actions);
        rustActionState.result = null; // Reset before sending new actions
        socket.emit('take-action', { actions: actions, job_id: jobID });

        // Wait for the result of the actions from Rust WebDriver with a timeout 
        let result = await new Promise((resolve) => {
            const checkResult = setInterval(() => {
                if (rustActionState.result !== null) {
                    clearInterval(checkResult);
                    resolve(Ok(rustActionState.result));
                }
            }, 250);
            // 45 second max timeout
            setTimeout(() => {
                clearInterval(checkResult);
                resolve(Err("Error (testDrive) : Timeout waiting for Rust WebDriver response"));
            }, 45000);
        });
        if(result.isErr()){
            console.error(result.value);
            return Err(`Error (testDrive) : ${result.value}`);
        }
        completedActions.push(...actions);
        console.log("Loop Completed. Moving on...");
    }

    console.log("Task Complete :)");
    return Ok({completedActionsString: JSON.stringify(completedActions), extractedData: extractedData.join("\n\n")});
}

const PromptsAndSchemas = {
    craftAction: {
        sys: `You are a website navigation and interaction expert. Your task it to create a series of atomic actions which will be performed on the specified webpage.

### Selector Selection Strategy
When choosing a CSS selector, follow this priority:
1. **ID**: (e.g., '#email-input')
2. **Unique Attributes**: (e.g., 'input[name="username"]', '[data-testid="login-button"]')
3. **ARIA Labels/Placeholders**: (e.g., 'input[aria-label="Search"]')
4. **Hierarchical paths**: Only use as a last resort (e.g., 'div > form > button'). 

Avoid dynamic classes (e.g., '.css-1abc23') that look auto-generated, as these change frequently.

### Contextual Awareness
Before performing an action, verify the element's purpose. 
- If multiple inputs exist, look for the associated <label> or placeholder text in the provided page state.
- If you are typing, ensure the selector targets an <input> or <textarea>, not their parent <div>.

### Available Actions
You have the following actions at your disposal:
- click(selector): Clicks on the element specified by the CSS selector.
- type(selector, text): Types the given text into the input field specified by the CSS selector.
- wait(delay_ms): Waits for the specified amount of milliseconds.
- scroll(x, y): Scrolls the webpage by the specified x and y pixel values.
- scroll_into_view(selector): Scrolls the webpage until the element specified by the CSS selector is in view.
- clear_field(selector): Clears the text from the input field specified by the CSS selector.

Important - only create actions that can be completed on the page you have been provided. Further actions will be conducted in the next round of the loop. If there is a cookie or GDPR banner - accept this first before any other actions. 

If a field performs a live search as you type then you should input the full string and no other action. This will allow you to get the updated HTML for the available options. 

If are unsure about the actions to take output an empty array. It's best to carry out 2-3 small actions and then check the resulting page than to output a large list of actions that may be rendered impossible by the dynamic nature of the web.

Output the actions as a JSON array of objects. Each object should have the following format:
{
    "action_type": "click" | "type_text" | "wait" | "scroll" | "scroll_into_view" | "clear_field",
    [other keys as required by the action type]
}`,
        usr: (task, completedActions, htmlCode) => {
            return `Here is the task from the user <task> ${task} </task> and the prior actions you have completed <completedActions> ${completedActions} </completedActions>. Here is the html for the page you must interact with <webPage> ${htmlCode} </webPage>`;
        },
        schema: {
            "type": "object",
            "properties": {
                "actions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                    "action_type": {
                        "type": "string",
                        "enum": [
                        "click",
                        "type_text",
                        "wait",
                        "scroll",
                        "scroll_into_view",
                        "clear_field"
                        ],
                        "description": "The specific browser action to perform."
                    },
                    "selector": {
                        "type": "string",
                        "description": "The CSS selector for the target element."
                    },
                    "text": {
                        "type": "string",
                        "description": "The text to type (used with type_text)."
                    },
                    "delay_ms": {
                        "type": "integer",
                        "description": "Time to wait in milliseconds (used with wait).",
                        "minimum": 0
                    },
                    "x": {
                        "type": "number",
                        "description": "X coordinate for coordinate-based actions."
                    },
                    "y": {
                        "type": "number",
                        "description": "Y coordinate for coordinate-based actions."
                    }
                    },
                    "required": ["action_type"]
                }
                }
            },
            "required": ["actions"]
        }
    },
    reviewTask: {
    sys: `You are a specialized Web Router. Your role is to analyze the <task> and <completedActions> to determine if the agent should extract data and whether the mission is finished.

    DECISION LOGIC:
    1. **extract_text_continue**: The required data is on the current page, but the task is NOT finished. Use this if the user wants data from multiple pages or has more steps to complete after this extraction.
    2. **extract_text_break**: The required data is on the current page, and once this specific extraction is done, the entire task is complete. No further navigation is needed.
    3. **task_complete**: The task is already finished (e.g., a form was submitted, or all data was already gathered). No extraction or further action is required.
    4. **no-action**: The required data is NOT on this page. The agent must continue navigating, clicking, or searching to find it or continue the task in another way - for example inputting data into a form or posting a comment.

    RULES:
    - For "extract_text_continue" and "extract_text_break", you MUST provide a clear string in "extractPrompt" describing what to grab.
    - For all other actions, "extractPrompt" must be "".
    - Do not perform the extraction yourself. Provide only the instruction.`,

        usr: (task, completedActions, htmlCode) => {
            return `USER TASK: ${task}
                    COMPLETED ACTIONS: ${completedActions}
                    CURRENT HTML: ${htmlCode}`;
        },

        schema: {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": [
                        "extract_text_continue", 
                        "extract_text_break", 
                        "no-action", 
                        "task_complete"
                    ],
                    "description": "The routing decision based on the current page state and task progress."
                },
                "extractPrompt": {
                    "type": "string",
                    "description": "Description of data to extract. Required for 'extract_text_continue/break'. Otherwise empty."
                }
            },
            "required": ["action", "extractPrompt"],
            "additionalProperties": false
        }
    }
}