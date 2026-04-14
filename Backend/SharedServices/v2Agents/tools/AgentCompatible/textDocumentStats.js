/*
    Uses The Hive Plugin Tool Standard
*/

export const details = {
    toolName:   "getTextDocumentStats",
    version:    "2026.0.1",
    creator:    "Botzy Bee",
    overview:   "A tool which returns the following information on the target text document: \n"+
                "line count, word count, characters, file size, file extension. \n"+
                "NOTE: This tool only works with utf-8 text documents and does not currently support docx and other Microsoft office formats.", 
    guide:      null,  
    inputSchema: {
        "type": "object",
        "properties": {
            "filePath": {
            "type": "string",
            "description": "The relative file path of the target text file."
            }
        },
        "required": ["filePath"],
        "additionalProperties": false
        }
    };


/**
 * 
 * @param {Services} Shared - For passing the SharedServices object exported via 'Services' 
 * @param {object}  options
 * @param {string}  options.filePath - Mandatory. The relative file path of the target text file. 
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
        return Shared.v2Core.Helpers.Err(`Error (readFile) : Params missing or incorrect. Params: should include filePath.`);
    }
    const rootPath = Shared.fileSystem.Constants.containerVolumeRoot;
    const targetURL = Shared.aiAgents.ToolHelpers.pathHelper.join(rootPath, filePath);
    let lineCount = null; // Initialize to null for non-text files
    let wordCount = null;
    let charCount = null;
    let nonWhitespaceCharCount = null;
    let fileSize = 0;
    let fileExtension = '';
    let fileSizeFormatted = '';
    // List of common text file extensions.
    const textFileExtensions = [
        'txt', 'md', 'js', 'json', 'html', 'css', 'xml', 'csv', 'log',
        'ts', 'jsx', 'tsx', 'vue', 'py', 'java', 'c', 'cpp', 'h', 'hpp',
        'sh', 'bat', 'ps1', 'yml', 'yaml', 'ini', 'cfg', 'conf', 'env',
        'sql', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'dart', 'scss', 'less',
        'txt', 'md', 'js', 'json', 'html', 'css', 'xml', 'csv', 'log',
        'ts', 'jsx', 'tsx', 'vue', 'py', 'java', 'c', 'cpp', 'h', 'hpp',
        'sh', 'bat', 'ps1', 'yml', 'yaml', 'ini', 'cfg', 'conf', 'env',
        'sql', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'dart', 'scss', 'less',
        'gitignore', 'editorconfig', 'npmignore', 'dockerfile', 'makefile',
        'properties', 'plist', 'toml', 'graphql', 'proto', 'sol', 'asm', 'clj',
        'groovy', 'perl', 'r', 'scala', 'vb', 'f', 'for', 'cob', 'ada', 'pas',
        'tex', 'rtf', 'srt', 'vtt', 'sub', 'ass', 'lrc', 'nfo', 'diz', 'tag',
        'lic', 'license', 'readme', 'changelog', 'news', 'todo', 'notes',
        'gitattributes', 'gitmodules', 'gitkeep', 'gitmessage'
    ];
    try {
        // Get file statistics (size)
        const stats = Shared.aiAgents.ToolHelpers.fsHelper.statSync(targetURL);
        fileSize = stats.size;
        fileSizeFormatted = Shared.v2Core.Utils.formatBytes(fileSize);
        // Get file extension and convert to lowercase, removing the leading dot
        fileExtension = Shared.aiAgents.ToolHelpers.pathHelper.extname(targetURL).toLowerCase().substring(1);
        // Only process for line, word, and character counts if it's a recognized text file
        if (textFileExtensions.includes(fileExtension)) {
        // Initialize text-specific counts to 0 before processing
        lineCount = 0;
        wordCount = 0;
        nonWhitespaceCharCount = 0;
        // Use readline to efficiently count lines, words, and non-whitespace characters
        const rl = Shared.aiAgents.ToolHelpers.readlineHelper.createInterface({
            input: Shared.aiAgents.ToolHelpers.fsHelper.createReadStream(targetURL, { encoding: 'utf8' }),
            crlfDelay: Infinity // Recognizes both \r\n and \n as line endings
        });
        for await (const line of rl) {
            lineCount++;
            nonWhitespaceCharCount += line.replace(/\s/g, '').length;
            // Split by one or more whitespace characters and filter out empty strings
            const wordsInLine = line.split(/\s+/).filter(word => word.length > 0);
            wordCount += wordsInLine.length;
        }
        // Read the entire file content to get an accurate total character count,
        // including all newline characters as they exist in the file.
        const fullContent = Shared.aiAgents.ToolHelpers.fsHelper.readFileSync(targetURL, 'utf8');
        charCount = fullContent.length;
        }
    } catch (err) {
        return Shared.v2Core.Helpers.Err(`Error (getTextDocumentStats) : ${err}`);
    }
    let message = new Shared.aiAgents.Classes.DataMessage({
        role: Shared.aiAgents.Constants.Roles.Tool, 
        mimeType: null, 
        data: {
            lines: lineCount,
            words: wordCount,
            characters: charCount,
            nonWhitespaceCharacters: nonWhitespaceCharCount,
            fileSize: fileSize,
            fileSizeFormatted: fileSizeFormatted,
            extension: fileExtension
        },
        toolName: "getTextDocumentStats",
        instructions: `Get the file stats for ${filePath}.`
    });
    return Shared.v2Core.Helpers.Ok([message]);
}