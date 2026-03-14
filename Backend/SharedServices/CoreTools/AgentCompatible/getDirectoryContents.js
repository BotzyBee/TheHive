/*
    Uses The Hive Plugin Tool Standard
*/

export const details = {
    toolName:   "getContentsOfDirectory",
    version:    "2026.0.1",
    creator:    "Botzy Bee",
    overview:   "Scans the target directory returning a string all folders and file paths within it - including sub-directories. \n"+
                "This data is returned as two arrays of string (file & folder paths) values. ", 
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
        return Shared.Utils.logAndErr(`Error (getContentsOfDirectory) : Params missing or incorrect. Params: relativeFolderPath`);
    }
    let call = await Shared.FileSystem.scanFolderRecursively(relativeFolderPath);
    if (call.isErr()){ return Shared.Utils.Err(`Error (getContentsOfDirectory -> scanFolderRecursively) : ${call.value}`)}

    let message = new Shared.Classes.DataMessage({
        role: Shared.Classes.Roles.Tool, 
        mimeType: null, 
        data: call.value,
        toolName: "getContentsOfDirectory",
        instructions: `Get the contents of the directory ${relativeFolderPath}.`
    });
    return Shared.Utils.Ok([message]);
}