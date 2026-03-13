import { Services } from "../index.js";

/**
 * 
 * @param {string} toolName - The name of the  
 * @param {string} filePath - this will either be the path to the plugin or 'built-in'
 * @param {object} params - the input parameters object for the tool. 
 * @returns {Result(any)} - returns the output from the agent tool.
 */
export async function callAgentTool(toolName, filePath, params){
    if(toolName == null || filePath == null){
        return Services.Utils.Err(`Error ( callTool ) : toolName or filePath missing or null.`)
    }
    if (filePath == Services.Constants.builtInFilePath){
        // built-in tool
        return Services.CoreTools.AgentCompatible[toolName].run(Services, params); // tools must return Ok/ Err.
    } else {
        // plug-in tool
        let readFile = await import(filePath);
        if(readFile){
            return readFile.run(Services, params);
        } else {
           return Services.Utils.Err(`Error ( callTool -> import ) : Could not read tool file - ${filePath}`); 
        }
    }
}