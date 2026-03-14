/*
    Uses The Hive Plugin Tool Standard
*/
export const details = {
    toolName:   "writeFile",
    version:    "2026.0.1",
    creator:    "Botzy Bee",
    overview:   "Writes (saves) data to a single file in a specified folder."+
                "The content can be utf8, Uint8Array or Buffer. The tool does not perform any other task.", 
    guide:      null,  
    inputSchema: {
        "type": "object",
        "properties": {
            "relativeFolderPath": {
            "type": "string",
            "description": "The relative path to where the file should be saved."
            },
            "fileContent": {
            "description": "The file content. Can be any type; stringification is handled automatically."
            },
            "fileNameIncExt": {
            "type": "string",
            "description": "The name of the file including the extension (e.g., 'filename.json').",
            "pattern": "^.+\\..+$"
            }
        },
        "required": [
            "relativeFolderPath",
            "fileContent",
            "fileNameIncExt"
        ],
        "additionalProperties": false
        }
    };

/**
 * 
 * @param {Services} Shared - For passing the SharedServices object exported via 'Services' 
 * @param {object}  options
 * @param {string}  options.relativeFolderPath - The relative path to where the file should be saved (within the knowledgebase)
 * @param {any}  options.fileContent - the file content, does not need to be stringified. This is handled automagically. 
 * @param {string}  options.fileNameIncExt - eg filename.json
 * @returns {Result[[TextMessage | ImageMessage | AudioMessage | DataMessage] | string ] } - Returns a result or string depending if Ok or Err.
 */
export async function run( 
    Shared, 
    params = {}
){  
    // Destructure input
    let { relativeFolderPath, fileContent, fileNameIncExt } = params;
    // Catch bad params
    if(relativeFolderPath == null || fileContent == null || fileNameIncExt == null ){
        return Shared.Utils.Err(`Error (writeFile) : Params missing or incorrect. Params: relativeFolderPath, fileContent, fileNameIncExt`);
    }
    // this is set in docker-compose.yml and maps to the UserFiles folder on the host machine
    const containerVolumeRoot = Shared.Constants.containerVolumeRoot; 
    //Construct the full path and save the content
    const targetDirectoryInContainer = Shared.Utils.pathHelper.join(containerVolumeRoot, relativeFolderPath);
    let call = await Shared.FileSystem.saveFile(targetDirectoryInContainer, fileContent, fileNameIncExt);
    if (call.isErr()){ return Shared.Utils.Err(`Error (writeFile -> saveFile) : ${call.value}`)}

    let message = new Shared.Classes.TextMessage({
        role: Shared.Classes.Roles.Tool, 
        mimeType: "text/plain", 
        textData: `File created in ${relativeFolderPath} with filename ${fileNameIncExt} - using the data provided. Mark task as complete!`,
        toolName: "writeFile",
        instructions: `Write content to file`
    });
    return Shared.Utils.Ok([message]);
}