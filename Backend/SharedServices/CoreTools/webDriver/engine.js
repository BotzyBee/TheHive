import { initWebDriver, getCurrentPageContent  } from "./socket.js";
import { Ok, Err } from '../../Utils/helperFunctions.js';
import { connectedSockets } from "../../../app.js";
import { Services } from '../../index.js';
import { cleanHtmlString } from './utils.js';
import { JobState } from "@google/genai";


let task = `Search for "Artificial General Intelligence" on Wikipedia, click on the first search result, and extract the first paragraph of the article.`;


export async function testDrive(){

    let socket = connectedSockets[0];
    if(!socket){ return Err("No connected sockets available for WebDriver communication.") }

    // Example usage: Initialize WebDriver with a URL and job ID
    let initResult = await initWebDriver(socket, "https://www.wikipedia.org/", "test-job-123");
    if(initResult.isErr()){
        console.error(initResult.value);
        return Err(`WebDriver initialisation failed: ${initResult.value}`);
    }
    
    let contentResult = await getCurrentPageContent(socket, "test-job-123");
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

    let agent = new Services.AiCall.AiCall();
    let call = await agent.generateText(
        PromptsAndSchemas.craftAction.sys,
        PromptsAndSchemas.craftAction.usr(task, "[ no-completed-actions ]", strippedContent),
        { structuredOutput: PromptsAndSchemas.craftAction.schema }
    );
    if(call.isErr()){
        console.error(call.value);
        return Err(`AI call failed: ${call.value}`);
    }
    let actions = call.value.actions;
    console.log("Generated Actions:", actions);

    // sending actions

    socket.emit('take-action', { actions: actions, job_id: "test-job-123" });

    // const containerVolumeRoot = Services.Constants.containerVolumeRoot; 
    // const targetDirectoryInContainer = Services.Utils.pathHelper.join(containerVolumeRoot, 'UserFiles/WebAgent/');
    // Services.FileSystem.saveFile(targetDirectoryInContainer, JSON.stringify(strippedContent, null, 2), `WebAgent_${Date.now()}.txt`);
    return Ok("Test drive completed successfully.");

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

Important - only create actions that can be completed on the page you have been provided. Further actions will be conducted in the next round of the loop. 

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
    }
}