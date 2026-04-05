import { initWebDriver, getCurrentPageContent  } from "./socket.js";
import { Ok, Err } from '../../Utils/helperFunctions.js';
import { connectedSockets } from "../../../app.js";
import { Services } from '../../index.js';
import { cleanHtmlString } from './utils.js';

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
    const strippedContent = cleanedResult.value.cleanedHtml;

    const containerVolumeRoot = Services.Constants.containerVolumeRoot; 
    const targetDirectoryInContainer = Services.Utils.pathHelper.join(containerVolumeRoot, 'UserFiles/WebAgent/');
    Services.FileSystem.saveFile(targetDirectoryInContainer, JSON.stringify(strippedContent, null, 2), `WebAgent_${Date.now()}.txt`);
    return Ok("Test drive completed successfully.");

}