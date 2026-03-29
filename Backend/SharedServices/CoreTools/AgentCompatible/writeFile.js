/*
    Uses The Hive Plugin Tool Standard
*/
export const details = {
    toolName:   "writeFile",
    version:    "2026.0.5",
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
            "mimeType": {
            "type": "string",
            "description": "The mime type of the data - for example 'text/plain'."
            },
            "fileContent": {
            "description": "The file content. Can be any type; stringification is handled automatically."
            },
            "fileName": {
            "type": "string",
            "description": "The name of the file excluding the extension (e.g., 'filename').",
            }
        },
        "required": [
            "relativeFolderPath",
            "fileContent",
            "fileName",
            "mimeType"
        ],
        "additionalProperties": false
        }
    };

/**
 * 
 * @param {Services} Shared - For passing the SharedServices object exported via 'Services' 
 * @param {object}  options
 * @param {string}  options.relativeFolderPath - The relative path to where the file should be saved (within the knowledgebase)
 * @param {string}  options.mimeType - The mime type of the content needing saved.
 * @param {any}  options.fileContent - the file content, does not need to be stringified. This is handled automagically. 
 * @param {string}  options.fileName - eg filename excluding extension
 * @returns {Result[[TextMessage | ImageMessage | AudioMessage | DataMessage] | string ] } - Returns a result or string depending if Ok or Err.
 */
export async function run( 
    Shared, 
    params = {}
){  
    // Destructure input
    let { relativeFolderPath, fileContent, fileName, mimeType } = params;

    // Catch bad params
    if(relativeFolderPath == null || fileContent == null || fileName == null || mimeType == null ){
        return Shared.Utils.Err(`Error (writeFile) : Params missing or incorrect. Params: relativeFolderPath, fileContent, fileName, mimeType`);
    }

    // Resolve Extension and Config
    let fileInfo = Shared.FileSystem.MIME_MAP.get(mimeType);
    if(!fileInfo) fileInfo = { ext: 'bin', encoding: 'utf8', writeFN: null };
    const finalFileName = fileName 
      ? `${fileName}.${fileInfo.extension}` 
      : `Undefined.${fileInfo.extension}`;

    // this is set in docker-compose.yml and maps to the UserFiles folder on the host machine
    const containerVolumeRoot = Shared.Constants.containerVolumeRoot; 
    //Construct the full path and save the content
    const targetDirectoryInContainer = Shared.Utils.pathHelper.join(containerVolumeRoot, relativeFolderPath);
    if(fileInfo.writeFN != null){
        let call = await fileInfo.writeFN({
            relativeFolderPath: targetDirectoryInContainer, 
            fileContent, 
            fileNameIncExt: finalFileName
        });
        if (call?.outcome == "Error"){ return Shared.Utils.Err(`Error (writeFile -> saveFile) : ${call.value}`)}

        let message = new Shared.Classes.TextMessage({
            role: Shared.Classes.Roles.Tool, 
            mimeType: "text/plain", 
            textData: `File created in ${relativeFolderPath} with filename ${finalFileName} - using the data provided. Mark task as complete!`,
            toolName: "writeFile",
            instructions: `Write content to file`
        });
        return Shared.Utils.Ok([message]);
    } else {
        return Shared.Utils.Err(`Error (writeFile) : No function for saving ${mimeType} files. Sorry!`)
    }
}