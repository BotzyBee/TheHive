/*
    Uses The Hive Plugin Tool Standard
*/
export const details = {
    toolName:   "readFile",
    version:    "2026.0.1",
    creator:    "Botzy Bee",
    overview:   "Reads a file on the host filesystem and returns the file contents. The tool can return base64 or utf-8 formats. \n"+
                "The tool does not perform any other task. It cannot modify the contents - it is read-only.", 
    guide:      null,  
    inputSchema: {
        "description": "Input parameters schema for the readFile tool.",
        "type": "object",
        "properties": {
            "filePath": {
                "description": "The URL path where the file is located.",
                "type": "string"
            }
        },
        "required": ["filePath"]
    }
};

/**
 * 
 * @param {Services} Shared - For passing the SharedServices object exported via 'Services' 
 * @param {object}  options
 * @param {string}  options.filePath - Mandatory. The task or action needing undertaken.
 * @returns {Result[[TextMessage | ImageMessage | AudioMessage | DataMessage] | string ] } - Returns a result or string depending if Ok or Err.
 */
export async function run( 
    Shared, 
    params = {}
){  
    // Destructure input
    const { filePath } = params;
    // Catch bad params
    if(filePath == null){
        return Shared.Utils.Err(`Error (ReadFile Tool) - Input filePath missing or null.`);
    }
    const root = Shared.Constants.containerVolumeRoot;
    const targetURL = Shared.Utils.pathHelper.join(root, filePath);
    // Get File data
    let fileInfo = Shared.FileSystem.getFileExtensionAndSize(targetURL); // returns : {"extension":"xlsx","sizeBytes":8665,"sizeFormatted":"8.46 KB"}}
    if(fileInfo.isErr()){
        return Shared.Utils.Err(`Error (readFile -> getFileExtensionAndSize) : ${fileInfo.value}`)
    }
    // lookup correct read tool
    let fileSupported = false;
    let fileMethods = undefined;
    for (const value of Services.FileSystem.MIME_MAP.values()) {
        if (value.extension === fileInfo.value.extension) {
            fileMethods = value;
            fileSupported = true;
            break; 
        }
    }
    if(fileSupported === false ){
        return Shared.Utils.Err(`Error (readFile) : Target file type is not supported. Target Type ${fileInfo.value.extension}`)
    }
    // Use the supplied read function;
    let toolCall = await fileMethods.readFN(targetURL);
    if(toolCall.isErr()){
        return Shared.Utils.Err(`Error (readFile -> fileMethods.readFN() : ${toolCall.value})`);
    }

    let message = new Shared.Classes.DataMessage({
        role: Shared.Classes.Roles.Tool, 
        mimeType: fileMethods.mimeType, 
        data: toolCall.value,
        toolName: "readFile",
        instructions: `Read the file: ${targetURL}`
    });
    return Shared.Utils.Ok([message]);
}

