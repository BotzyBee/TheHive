import { Services } from "../index.js";
import { SupportedFiles } from "../FileSystem/index.js";
import { saveFile } from "../FileSystem/index.js";
import path from 'path';

/**
 * 
 * @param {string} toolName - The name of the  
 * @param {string} filePath - this will either be the path to the plugin or 'built-in'
 * @param {object} params - the input parameters object for the tool. 
 * @returns {Result(any)} - returns the output from the agent tool.
 */
export async function callAgentTool(toolName, filePath, params){
    if(toolName == null || filePath == null){
        return Services.Utils.Err(`Error ( callTool ) : toolName or filePath missing or null.`)
    }
    if (filePath == Services.Constants.builtInFilePath){
        // built-in tool
        return Services.CoreTools.AgentCompatible[toolName].run(Services, params); // tools must return Ok/ Err.
    } else {
        // plug-in tool
        let readFile = await import(filePath);
        if(readFile){
            return readFile.run(Services, params);
        } else {
           return Services.Utils.Err(`Error ( callTool -> import ) : Could not read tool file - ${filePath}`); 
        }
    }
}


/**
 * Creates a new object where the key is the mime type rather than extension. 
 */
export const MIME_MAP = Object.entries(SupportedFiles.default).reduce((acc, [ext, config]) => {
  acc[config.mimeType] = { ext, ...config };
  return acc;
}, {});

/**
 * Saves the core content of a Message class.
 * @param {BaseMessage} message - Any instance of Text, Image, Audio, or DataMessage
 * @param {string} folderPath - Target directory
 * @param {string} [fileName] - Optional filename excluding extension (defaults to message ID)
 * @returns {Promise<Result>}
 */
export async function saveMessageContent(message, folderPath, fileName = null) {
  try {
    let contentToSave;
    let options = { encoding: fileInfo.encoding };

    const targetDirectoryInContainer = path.join( Services.Constants.containerVolumeRoot, folderPath);
    // Extract content based on message type
    // We prioritise raw data/base64 over metadata
    switch (message.type) {
      case 'text':
        contentToSave = message.textData;
        break;

      case 'image':
        // If we have base64, save it. If only a URL, we'd need a fetch step (omitted for brevity)
        if (message.base64) {
          contentToSave = message.base64;
          options.encoding = 'base64'; 
        } else if (message.url) {
          return Services.Utils.Err(`Error (saveMessageContent) : Cannot save remote URL ${message.type} directly. Download required.`);
        }
      case 'audio':
        // If we have base64, save it. If only a URL, we'd need a fetch step (omitted for brevity)
        if (message.base64) {
          // Can only handle audio/L16;codec=pcm;rate=24000 at the moment! 
          if(message.mime == "audio/L16;codec=pcm;rate=24000"){
            contentToSave = processBase64Audio_ToWavBuffer(message.base64, message.mime); 
            message.mime = "audio/wav"; // update for ext lookup.
          } else {
            return Services.Utils.Err(`Error (saveMessageContent) : Only audio/L16;codec=pcm;rate=24000 type audio can be saved at this time.`);
          }
        } else if (message.url) {
          return Services.Utils.Err(`Error (saveMessageContent) : Cannot save remote URL ${message.type} directly. Download required.`);
        }
        break;

      case 'data':
        contentToSave = message.data; // saveFile handles objects via JSON.stringify
        break;

      default:
        // Fallback: Save the whole message object as JSON if type is unknown
        contentToSave = message.toJSON();
        return await saveFile(targetDirectoryInContainer, contentToSave, `${message.id}.json`);
    }

    if (!contentToSave) {
        return Services.Utils.Err(`Error (saveMessageContent) : No savable content found for message ${message.id}`);
    }

    // Resolve Extension and Config
    const fileInfo = MIME_MAP[message.mime] || { ext: 'bin', encoding: 'utf8' };
    const finalFileName = fileName 
      ? `${fileName}.${fileInfo.ext}` 
      : `${message.id}.${fileInfo.ext}`;

    // Delegate to the optimized saveFile function
    return await saveFile(targetDirectoryInContainer, contentToSave, finalFileName, options);

  } catch (error) {
    return Services.Utils.Err(`Error (saveMessageContent) : saveMessageContent Exception: ${error.message}.`);
  }
}


// Helper function for processBase64Audio_ToWavBuffer
function createWavHeader(dataLength, sampleRate, numChannels, bitDepth) {
  const header = Buffer.alloc(44);
  const blockAlign = (numChannels * bitDepth) / 8;
  const byteRate = sampleRate * blockAlign;
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLength, 4); 
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);           // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20);            // AudioFormat (1 for PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40);
  return header;
}

/**
 * Used to convert audio/L16;codec=pcm;rate=24000 to a Wav buffer for saving. 
 * @param {string} base64_Audio - Base64 audio (audio/L16;codec=pcm;rate=24000) 
 * @returns {Buffer | Null} - Returns Buffer or null.  
 */
export function processBase64Audio_ToWavBuffer(base64_Audio, mime){
  if(mime == "audio/L16;codec=pcm;rate=24000"){
    const pcmData = Buffer.from(base64_Audio, 'base64');
    const header = createWavHeader(pcmData.length, 24000, 1, 16);
    const finalBuffer = Buffer.concat([header, pcmData]);
    return finalBuffer;
  }
  return null;
}

