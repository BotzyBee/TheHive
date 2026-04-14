/*
    Uses The Hive Plugin Tool Standard
*/
export const details = {
    toolName:   "getContentsOfDirectory",
    version:    "2026.0.1",
    creator:    "Botzy Bee",
    overview:   "Scans the target directory returning a string all folders and file paths within it - including sub-directories. \n"+
                "This data is returned as two arrays of string (file & folder paths) values. \n"+
                "This tool does not return the data from any files. To do this you will need to use the 'readFile' tool. \n"+
                "You should use this tool if you are needing to read or modify a file however you first need to find the file path. \n"+
                "You can also use this tool to get an overview of the contents of a directory.", 
    guide:      null,  
    inputSchema:{
    "type": "object",
    "properties": {
        "relativeFolderPath": {
        "type": "string",
        "description": "The relative path of the target folder."
        }
    },
    "required": ["relativeFolderPath"],
    "additionalProperties": false
    }
};


/**
 * 
 * @param {Services} Shared - For passing the SharedServices object exported via 'Services' 
 * @param {object}  options
 * @param {string}  options.relativeFolderPath - Mandatory. The relative path of the target folder. 
 * @returns {Result[[TextMessage | ImageMessage | AudioMessage | DataMessage] | string ] } - Returns a result or string depending if Ok or Err.
 */
export async function run( 
    Shared, 
    params = {}
){  
    // Destructure input
    const { relativeFolderPath } = params;
    // Catch bad params
    if(relativeFolderPath == null){
        return Shared.v2Core.Helpers.Err(`Error (getContentsOfDirectory) : Params missing or incorrect. Params: relativeFolderPath`);
    }
    let call = await Shared.fileSystem.CRUD.scanFolderRecursively(relativeFolderPath);
    if (call.isErr()){ return Shared.v2Core.Helpers.Err(`Error (getContentsOfDirectory -> scanFolderRecursively) : ${call.value}`)}

    let message = new Shared.aiAgents.Classes.DataMessage({
        role: Shared.aiAgents.Constants.Roles.Tool, 
        mimeType: null, 
        data: call.value,
        toolName: "getContentsOfDirectory",
        instructions: `Get the contents of the directory ${relativeFolderPath}.`
    });
    return Shared.v2Core.Helpers.Ok([message]);
}