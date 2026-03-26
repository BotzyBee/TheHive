import { Services } from '../SharedServices/index.js';
import * as coreToolCollection from '../SharedServices/CoreTools/AgentCompatible/index.js';
import { pluginDir, containerVolumeRoot, toolTableName, vectorEmbedSize, builtInFilePath } from '../SharedServices/constants.js';
import path from 'path';

function fetchCoreAgentTools() {
    const results = []; 
    // Destructure [key, value] from each entry
    // 'name' is the string key, 'module' is the actual Module object
    for (const [name, module] of Object.entries(coreToolCollection)) {
        
        // Check the 'details' property on the module itself
        if (module && typeof module.details === 'object') {
            const data = module.details;
            results.push(
                {
                    filePath: builtInFilePath, 
                    toolName: data.toolName,
                    version: data.version,
                    overview: data.overview
                }
            );
        }
    }
    return Services.Utils.Ok(results);
}

export async function fetchPluginAgentTools(){
    let tool = Services.FileSystem.scanFolderRecursively;
    let call = await tool(`${pluginDir}/Tools`);
    if(call.isErr()){ return Services.Utils.Err(
        `Error (fetchPluginAgentTools -> scanFolderRecursively ) : ${call.value}`
    )}
    let allFiles = call.value.fileList ?? [];
    let allFilesLen = allFiles.length ?? 0;
    if( allFilesLen == 0 ){ return Services.Utils.Ok([])}

    //Fetch Tools
    let results = [];
    for(let i=0; i< allFilesLen; i++){
        // read
        if(allFiles[i].includes('.js')){
            let fp = path.join(containerVolumeRoot, allFiles[i]);
            const readFile = await import(fp);
            if(readFile?.details && readFile?.run){
                results.push({
                    filePath: fp,
                    toolName: readFile.details.toolName,
                    version: readFile.details.version,
                    overview: readFile.details.overview
                })
            }
        }
    }
    return Services.Utils.Ok(results);
}

export async function initToolIndex(){
    // Find all tools and extract details (Plugin & Core)
    let builtIn = fetchCoreAgentTools(); // doesn't need Err catch! 
    let plugIn = await fetchPluginAgentTools();
    if(plugIn.isErr()){ return Services.Utils.Err(`Error ( initToolIndex -> fetchPluginAgentTools ) : ${plugIn.value}`) }
    let merge = [...builtIn.value, ...plugIn.value];
    let combined = deduplicateByToolName(merge);
    // Process them into the DB (check if exist, check new version, add if needed);
    const cLen = combined.length ?? 0;
    let getDB = await Services.Database.getDbAgent();
    if(getDB.isErr()){
        return Services.Utils.Err(`Error ( initToolIndex -> getDbAgent ) : ${getDB.value}`);
    }
    const db = getDB.value;
    let stats = { tools: 0, added: 0, updated: 0, removed: 0 }
    for( let i=0; i<cLen; i++ ){
        console.log("Checking : ", combined[i].toolName);
        // check if exists
        let check = await Services.Database.getRecords( db, toolTableName, "ToolName", combined[i].toolName );
        if(check.isErr()){ return Services.Utils.Err(`Error ( initToolIndex -> getRecords ) : ${getDB.value}`); }
        // if exists - check if needs updated
        if(check.value[0].length != 0 ){ 
            if(check.value[0][0].ToolName == combined[i].toolName && check.value[0][0].Version != combined[i].version){
                let dCall = await removeToolFromDB(db, combined[i].toolName);
                if(dCall.isErr()){
                    return Services.Utils.Err(`Error ( initToolIndex -> removeToolFromDB ) : ${dCall.value}`);
                }
                let aCall = await addToolToDB(db, combined[i]);
                if(aCall.isErr()){
                    return Services.Utils.Err(`Error ( initToolIndex -> addToolToDB ) : ${aCall.value}`);
                }
                stats.updated++;
            }
        } else {
            // Doesn't exist - add it
            let aCall = await addToolToDB(db, combined[i]);
            if(aCall.isErr()){
                return Services.Utils.Err(`Error ( initToolIndex -> addToolToDB ) : ${aCall.value}`);
            }
            stats.added++;
        }
        stats.tools++;
    } // i

    // Check for deleted tools 
    let checkDeleted = await checkForDeletedTools(db, combined);
    if(checkDeleted.isErr()){
        return Services.Utils.Err(`Error ( initToolIndex -> checkForDeletedTools ) : ${checkDeleted.value}`);
    }
    stats.removed = checkDeleted.value;
    return Services.Utils.Ok(stats);
}


/***
 * Adds tool to Tool Vector Table in the database. 
 * @param {object} dbObject - DB agent - use getDbAgent() for this
 * @param {object} toolObject - { toolName: string, overview: string, version: string, filePath: string } 
 */
async function addToolToDB(dbObject, toolObject){
    let vec = await new Services.AiCall.AiCall().generateEmbeddings(
        {inputDataVec: [toolObject.overview], dimensionSize: vectorEmbedSize, quality: 1 });
    if( vec.isErr() ){ return Services.Utils.Err(`Error ( addToolToDB -> generateEmbeddings ) : ${vec.value}`); }
    let dbCall = await Services.Database.addVectorToolToDB(
        dbObject,
        toolTableName,
        toolObject.toolName,
        toolObject.overview,
        toolObject.version,
        toolObject.filePath,
        vec.value[0]
    );
    if(dbCall.isErr()){
        return Services.Utils.Err(`Error ( addToolToDB -> addVectorToolToDB ) : ${dbCall.value}`);
    }
    return Services.Utils.Ok(null);
}

/**
 * 
 * @param {object} dbObject - DB agent - use getDbAgent() for this
 * @param {string} toolName - name of the tool to be removed. 
 * @returns {Result}
 */
async function removeToolFromDB(dbObject, toolName){
    let dbCall = await Services.Database.deleteRecordsByField(
        dbObject,
        toolTableName,
        "ToolName",
        toolName
    );
    if(dbCall.isErr()){
        return Services.Utils.Err(`Error ( removeTool -> deleteRecordsByField ) : ${dbCall.value}`);
    }
    return Services.Utils.Ok(null);
}

/**
 * 
 * @param {array[object]} input - [{ toolName: string, overview: string, version: string, filePath: string }, ...]
 * @returns - a de-duplicated version of the input. 
 */
function deduplicateByToolName(input) {
  const uniqueMap = new Map(
    input.map(item => [item.toolName, item])
  );
  // Convert the Map values back into an array
  return Array.from(uniqueMap.values());
}

/**
 * @param {object} dbObject - DB agent - use getDbAgent() for this  
 * @param {Array[object]} liveTools -  [{ toolName: string, overview: string, version: string, filePath: string }, ...]
 * @returns {Result(number)} - the number of tools removed. 
 */
async function checkForDeletedTools(dbObject, liveTools){
    let dbCall = await Services.Database.getAllRecordsFromTable(dbObject, toolTableName );
    if( dbCall.isErr()){
        return Services.Utils.Err(`Error ( initToolIndex -> checkForDeletedTools ) : ${dbCall.value}`);
    }
    // Check DB list against the 'live' tools found in folders.
    let tLen = dbCall.value.length ?? 0;
    let liveLen = liveTools.length ?? 0;
    let deleteList = [];
    for(let i=0; i<tLen; i++){
        let dbTool = dbCall.value[i].ToolName;
        let found = false;
        for(let k=0; k<liveLen; k++){
            if(liveTools[k].toolName == dbTool){
                found = true;
                break;
            }
        }
        if(found == false){
            deleteList.push(dbTool);
        }
    }
    // Old DB tool not present in 'live' tools
    let dLen = deleteList.length ?? 0;
    let removed = 0;
    for(let i=0; i<dLen; i++){
        let call = await removeToolFromDB(dbObject, deleteList[i]);
        if( call.isErr()){
            return Services.Utils.Err(`Error ( initToolIndex -> checkForDeletedTools 2 ) : ${call.value}`);
        }
        removed++;
    }
    return Services.Utils.Ok(removed) 
}