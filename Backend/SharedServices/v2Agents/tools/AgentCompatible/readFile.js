/*
    Uses The Hive Plugin Tool Standard
*/
export const details = {
    toolName:   "readFile",
    version:    "2026.0.1",
    creator:    "Botzy Bee",
    overview:   "Reads a file on the host filesystem and returns the file contents. The tool can return base64 or utf-8 formats. \n"+
                "The tool does not perform any other task. It cannot modify the contents - it is read-only. \n"+
                "You must know the file path in advance. If this is unknown, you can use the 'listFilesAndDirectories' tool to explore the filesystem and find the file path."+
                " You must include the file name and extension in the file path.", 
    guide:      "If the user provides a URL in their instructions you should use it exactly as provided. Never include /data/ at the start of a URL - this is automatically added later.",  
    inputSchema: {
        "description": "Input parameters schema for the readFile tool.",
        "type": "object",
        "properties": {
            "filePath": {
                "description": "The URL path where the file is located. This must include the file name and extension. ",
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
        return Shared.v2Core.Helpers.Err(`Error (ReadFile Tool) - Input filePath missing or null.`);
    }

    let decodedPath;
    try {
        decodedPath = decodeURIComponent(filePath);
    } catch (e) {
        // If decoding fails, just use the original path
        decodedPath = filePath;
    }

    // Catch if AI has added data prefix (remove it)
    const prefix = "/data/";
    if (decodedPath.startsWith(prefix)) {
    decodedPath = decodedPath.slice(prefix.length);
    }
    if (!decodedPath.startsWith('/UserFiles/') && !decodedPath.startsWith('UserFiles/')) {
        decodedPath = Shared.aiAgents.ToolHelpers.pathHelper.join('/UserFiles/', decodedPath.trim());;
    }

    const root = Shared.fileSystem.Constants.containerVolumeRoot 
    const targetURL = Shared.aiAgents.ToolHelpers.pathHelper.join(root, decodedPath.trim());
    
    if (!targetURL.startsWith(root)) {
        return Shared.v2Core.Helpers.Err(`Error: Access denied. Path is outside of allowed directory.`);
    }

    // Get File data
    let fileInfo = Shared.fileSystem.CRUD.getFileExtensionAndSize(targetURL); // returns : {"extension":"xlsx","sizeBytes":8665,"sizeFormatted":"8.46 KB"}}
    if(fileInfo.isErr()){
        return Shared.v2Core.Helpers.Err(`Error (readFile -> getFileExtensionAndSize) : ${fileInfo.value}`)
    }
    // lookup correct read tool
    let strategyToUse = Shared.fileSystem.IO.fileRegistry.getByExt(fileInfo.value.extension).strategy;
    if(strategyToUse.read == null){
        return Shared.v2Core.Helpers.Err(`Error (readFile) : No strategy to read ${fileInfo.value.extension} files.`)
    }

    // Use the supplied read function;
    let toolCall = await strategyToUse.read(targetURL);
    if(toolCall.isErr()){
        return Shared.v2Core.Helpers.Err(`Error (readFile -> strategyToUse.readFN() : ${toolCall.value})`);
    }

    let message = new Shared.aiAgents.Classes.DataMessage({
        role: Shared.aiAgents.Constants.Roles.Tool, 
        ext: fileInfo.value.extension,
        data: toolCall.value,
        toolName: "readFile",
        instructions: `Read the file: ${targetURL}`
    });
    return Shared.v2Core.Helpers.Ok([message]);
}

