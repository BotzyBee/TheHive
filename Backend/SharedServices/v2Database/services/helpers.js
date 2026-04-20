
import { vectorEmbedSize, toolTableName, guideTableName } from "../core/constants.js";
import { searchVectorRecords, getRecords } from "./CRUD.js";
import { Services } from "../../index.js";
import { getDbAgent } from "./manageDb.js";
import * as CoreTools from '../../v2Agents/tools/AgentCompatible/index.js';

/**
 * Performs a vector search on the DB to get tools that match the task. 
 * @param {string} task - the task needing completed 
 * @param {number} limit - the number of tools to return 
 * @param {boolean} modeTools - if true will return matching tools, if false will return matching guides.
 * @returns {Result<Array<object>} - Result([
 * { ToolName: string, ToolDescription: string, Version: string, FilePath: string,  Vector: [] } ]);
 */
export async function getToolsOrGuidesForTask(task, limit, modeTools = true){
    // Get DB Agent
    let tableName = modeTools ? toolTableName : guideTableName;
    let getDB = await getDbAgent();
    if(getDB.isErr()){
        return Services.v2Core.Helpers.Err(`Error ( getToolsOrGuidesForTask -> getDbAgent ) : ${getDB.value}`);
    }
    const db = getDB.value;
    // Create embedding of task
    let ai = Services.callAI.aiFactory();
    let vec = await ai.generateEmbeddings(
    {inputDataVec: [task], dimensionSize: vectorEmbedSize, quality: 1 });
    if( vec.isErr() ){ return Services.v2Core.Helpers.Err(`Error ( getToolsOrGuidesForTask -> generateEmbeddings ) : ${vec.value}`); }
    // Search the database
    let search = await searchVectorRecords(db, tableName, vec.value[0], limit);
    if( search.isErr() ){ return Services.v2Core.Helpers.Err(`Error ( getToolsOrGuidesForTask -> searchVectorRecords ) : ${JSON.stringify(search.value, null, 2)}`); }
    // remove embeddings
    let resLen = search.value[0].length ?? 0;
    for(let i=0; i<resLen; i++){
        search.value[0][i].FilePath = decodeURIComponent(search.value[0][i].FilePath);
        search.value[0][i].Vector = [];
    }
    return Services.v2Core.Helpers.Ok(search.value[0]);
}

/**
 * Fetches the tool 'details' object for plugin or built-in tools.
 * @param {string} toolName - the name of the tool 
 * @returns {Result(object)} - Result( {filePath: string, details: details object from tool file. } )
 */
export async function getToolDetails(toolName){
    // Get DB Agent
    let getDB = await getDbAgent();
    if(getDB.isErr()){
        return Services.v2Core.Helpers.Err(`Error ( getToolDetails -> getDbAgent ) : ${getDB.value}`);
    }
    const db = getDB.value;
    // Search DB
    let search = await getRecords(db, toolTableName, "ToolName", toolName);
    if( search.isErr() ){ return Services.v2Core.Helpers.Err(`Error ( getToolDetails -> getRecords ) : ${search.value}`); }
    let resLen = search.value[0]?.length ?? 0;
    if(resLen == 0){ return Services.v2Core.Helpers.Err(`Error ( getToolDetails -> getRecords 2 ) : DB returned no results `);}
    // Get tool object
    const fp = search.value[0][0].FilePath;
    let decodedFP;
    // built in path isn't proper URL.. so can only decode it's N8N or plugin.
    if(fp != Services.fileSystem.Constants.builtInFilePath){
        decodedFP = decodeURIComponent(fp);
    }
    let toolObj; 
    if(fp == Services.fileSystem.Constants.builtInFilePath){
        // Built in tool
        toolObj = CoreTools[toolName].details;
    } else if(decodedFP.includes(Services.database.Constants.N8N_Url)) {
        // N8N Tool
        let axios = Services.aiAgents.ToolHelpers.axiosHelper;
        let call = await axios.get(`${decodedFP}/details`);
        toolObj = call.data[0]; // comes back in an array [{...details...}]
    } 
    else {
        // Plugin tool
        let readFile = await import(/* @vite-ignore */ decodedFP);
        if(readFile){
            toolObj = readFile.details;
        } else {
           return Services.v2Core.Helpers.Err(`Error ( getToolDetails -> import ) : Could not read file - ${fp}`); 
        }
    }
    
    return Services.v2Core.Helpers.Ok({filePath: decodedFP ? decodedFP : fp, details: toolObj})
}