/*
    Uses The Hive Plugin Tool Standard
*/


export const details = {
    toolName:   "findFileorFolder",
    version:    "2026.0.1",
    creator:    "Botzy Bee",
    overview:   "Searches for a specified file or folder and returns any file paths (urls) that contain the search term. Can only search for a single term at a time. \n"+
                "The tool does not read the content of the files - only the file paths. The tool does not return the content of the file - only location/ file path of matches", 
    guide:      null,  
    inputSchema:{
        "type": "object",
        "properties": {
            "searchTerm": {
            "type": "string",
            "description": "The search term for finding a file or directory by name.",
            "minLength": 1
            }
        },
        "required": ["searchTerm"],
        "additionalProperties": false
        }
    };


/**
 * 
 * @param {Services} Shared - For passing the SharedServices object exported via 'Services' 
 * @param {object}  options
 * @param {string}  options.searchTerm - Mandatory. The search term for finding a file or directory by name.
 * @returns {Result[[TextMessage | ImageMessage | AudioMessage | DataMessage] | string ] } - Returns a result or string depending if Ok or Err.
 */
export async function run( 
    Shared, 
    params = {}
){  
    // Destructure input
    const { searchTerm } = params;
    // Catch bad params
    if(searchTerm == null){
        return Shared.Utils.Err(`Error (findFileorFolder) : Params missing or incorrect. Param needed: searchTerm`);
    }
    let userFolder = Shared.Constants.userFilesDir;
    let allFoldersAndFiles = await Shared.FileSystem.scanFolderRecursively(`/${userFolder}`);
    if (allFoldersAndFiles.isErr()){ return Shared.Utils.Err(`Error (findFileorFolder -> scanFolderRecursively) : ${allFoldersAndFiles.value}`)}
    let dirListLen = allFoldersAndFiles.value.directoryList.length ?? 0;   //url  directoryList, fileList
    let fileListLen = allFoldersAndFiles.value.fileList.length ?? 0; // fileUrl
    let matches = [];
    let i;
    for(i=0; i<dirListLen; i++){
        if(allFoldersAndFiles.value.directoryList[i].includes(searchTerm)){
            matches.push(allFoldersAndFiles.value.directoryList[i]);
        }
    }
    for(i=0; i<fileListLen; i++){
        if(allFoldersAndFiles.value.fileList[i].includes(searchTerm)){
            matches.push(allFoldersAndFiles.value.fileList[i]);
        }
    }
    let message = new Shared.Classes.DataMessage({
        role: Shared.Classes.Roles.Tool, 
        mimeType: null, 
        data: matches,
        toolName: "findFileorFolder",
        instructions: `Find: ${searchTerm}`
    });
    return Shared.Utils.Ok([message]);
}



