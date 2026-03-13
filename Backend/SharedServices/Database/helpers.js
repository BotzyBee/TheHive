import { vectorEmbedSize, toolTableName, builtInFilePath } from '../constants.js';
import { searchVectorRecords } from './CRUD.js';
import { Services } from '../index.js';

/**
 * Performs a vector search on the DB to get tools that match the task. 
 * @param {string} task - the task needing completed 
 * @param {number} limit - the number of tools to return 
 * @returns {Result(object)} - Result(
 * { ToolName: string, ToolDescription: string, Version: string, FilePath: string,  Vector: [] } );
 */
export async function getToolsForTask(task, limit){
    // Get DB Agent
    let getDB = await Services.Database.getDbAgent();
    if(getDB.isErr()){
        return Services.Utils.Err(`Error ( matchToolsToTask -> getDbAgent ) : ${getDB.value}`);
    }
    const db = getDB.value;
    // Create embedding of task
    let vec = await new Services.AiCall.AiCall().generateEmbeddings(
    {inputDataVec: [task], dimensionSize: vectorEmbedSize, quality: 1 });
    if( vec.isErr() ){ return Services.Utils.Err(`Error ( matchToolsToTask -> generateEmbeddings ) : ${vec.value}`); }
    // Search the database
    let search = await searchVectorRecords(db, toolTableName, vec.value[0], limit);
    if( search.isErr() ){ return Services.Utils.Err(`Error ( matchToolsToTask -> searchVectorRecords ) : ${search.value}`); }
    // remove embeddings
    let resLen = search.value[0].length ?? 0;
    for(let i=0; i<resLen; i++){
        search.value[0][i].FilePath = decodeURIComponent(search.value[0][i].FilePath);
        search.value[0][i].Vector = [];
    }
    return Services.Utils.Ok(search.value[0]);
}

/**
 * Fetches the tool 'details' object for plugin or built-in tools.
 * @param {string} toolName - the name of the tool 
 * @returns {Result(object)} - Result( {filePath: string, details: details object from tool file. } )
 */
export async function getToolDetails(toolName){
    // Get DB Agent
    let getDB = await Services.Database.getDbAgent();
    if(getDB.isErr()){
        return Services.Utils.Err(`Error ( getToolDetails -> getDbAgent ) : ${getDB.value}`);
    }
    const db = getDB.value;
    // Search DB
    let search = await Services.Database.getRecords(db, toolTableName, "ToolName", toolName);
    if( search.isErr() ){ return Services.Utils.Err(`Error ( getToolDetails -> searchVectorRecords ) : ${search.value}`); }
    let resLen = search.value[0]?.length ?? 0;
    if(resLen == 0){ return Services.Utils.Err(`Error ( getToolDetails -> searchVectorRecords 2 ) : DB returned no results `);}
    // Get tool object
    const fp = search.value[0][0].FilePath;
    let toolObj; 
    if(fp == builtInFilePath){
        // Built in tool
        toolObj = Services.CoreTools.AgentCompatible[toolName].details;
    } else {
        // Plugin tool
        let decodedFP = decodeURIComponent(fp);
        fp = decodedFP;
        let readFile = await import(decodedFP);
        if(readFile){
            toolObj = readFile.details;
        } else {
           return Services.Utils.Err(`Error ( getToolDetails -> import ) : Could not read file - ${fp}`); 
        }
    }
    return Services.Utils.Ok({filePath: fp, details: toolObj})
}