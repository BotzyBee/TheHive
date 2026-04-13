// import { saveFile } from "../FileSystem/index.js";
// import { MIME_MAP } from "../../v2FileSystem/services/supportedFiles.js";
// import path from 'path';
// import { builtInFilePath } from "../constants.js";
// import * as CoreTools from '../../CoreTools/index.js';
// import { Err } from '../Utils/helperFunctions.js';
// import { Services } from "../../index.js";
// import { containerVolumeRoot } from "../constants.js";

let injectedDependencies = {
  ...Services,
};
injectedDependencies.Helpers = {
    saveMessageContent,
    processBase64Audio_ToWavBuffer,
    callAgentTool
};
/**
 * 
 * @param {string} toolName - The name of the tool to call.
 * @param {string} filePath - this will either be the path to the plugin or 'built-in'
 * @param {object} params - the input parameters object for the tool. 
 * @param {object} agentDependencies - this is an optional parameter that can be used to pass in any additional dependencies the tool may need. 
 * @returns {Result(any)} - returns the output from the agent tool.
 */
export async function callAgentTool(toolName, filePath, params, agentDependencies = {}){
    if(toolName == null || filePath == null){
        return Err(`Error ( callTool ) : toolName or filePath missing or null.`)
    }
    if (filePath == builtInFilePath){
        // built-in tool
        return CoreTools.AgentCompatible[toolName].run(injectedDependencies, params, agentDependencies); // tools must return Ok/ Err.
    } else {
        // plug-in tool
        let readFile = await import(/* @vite-ignore */ filePath);
        if(readFile){
            return readFile.run(injectedDependencies, params, agentDependencies);
        } else {
           return Err(`Error ( callTool -> import ) : Could not read tool file - ${filePath}`); 
        }
    }
}

/**
 * Saves the core content of a Message class.
 * @param {BaseMessage} message - Any instance of Text, Image, Audio, or DataMessage
 * @param {string} folderPath - Target directory
 * @param {string} [fileName] - Optional filename excluding extension (defaults to message ID)
 * @returns {Promise<Result>}
 */
export async function saveMessageContent(message, folderPath, fileName = null) {
  if(!message || !folderPath){
    return Err(`Error (saveMessageContent) : message or folderPath missing or null.`)
  }
  try {
    let contentToSave;
    // Resolve Extension and Config
    let fileInfo = MIME_MAP.get(message.mime);
    if(!fileInfo) fileInfo = { ext: 'bin', encoding: 'utf8' };
    const finalFileName = fileName 
      ? `${fileName}.${fileInfo.extension}` 
      : `${message.id}.${fileInfo.extension}`;

    let options = { encoding: fileInfo.encoding };

    const targetDirectoryInContainer = path.join( containerVolumeRoot, folderPath);
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
          return Err(`Error (saveMessageContent) : Cannot save remote URL ${message.type} directly. Download required.`);
        }
      case 'audio':
        // If we have base64, save it. If only a URL, we'd need a fetch step (omitted for brevity)
        if (message.base64) {
          // Can only handle audio/L16;codec=pcm;rate=24000 at the moment! 
            contentToSave = processBase64Audio_ToWavBuffer(message.base64, message.mime); 
        } else if (message.url) {
          return Err(`Error (saveMessageContent) : Cannot save remote URL ${message.type} directly. Download required.`);
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
    await saveFile(targetDirectoryInContainer, `Contenxt to save ${message}`, finalFileName, options);
    if (!contentToSave) {
        return Err(`Error (saveMessageContent) : No savable content found for message ${message.id}`);
    }

    // Delegate to the optimized saveFile function
    return await saveFile(targetDirectoryInContainer, contentToSave, finalFileName, options);

  } catch (error) {
    return Err(`Error (saveMessageContent) : saveMessageContent Exception: ${error.message}.`);
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

// WIP! 
// import { spawn } from 'child_process';

// /**
//  * Converts PCM L16 (24kHz) to Ogg Opus for Telegram Voice Messages.
//  * @param {Buffer} pcmBuffer - Raw PCM data from Gemini
//  * @returns {Promise<Buffer>} - Telegram-ready Ogg/Opus Buffer
//  */
// export function convertToTelegramVoice(pcmBuffer) {
//   return new Promise((resolve, reject) => {
//     // FFmpeg settings:
//     // -f s16le: Input is raw 16-bit little-endian PCM
//     // -ar 24000: Input sample rate is 24kHz (Gemini standard)
//     // -ac 1: Input is mono
//     // -c:a libopus: Encode to Opus codec
//     // -f opus: Wrap in Ogg container (Telegram voice format)
//     const ffmpeg = spawn('ffmpeg', [
//       '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', 'pipe:0',
//       '-c:a', 'libopus', '-b:a', '32k', '-vbr', 'on', 
//       '-f', 'opus', 'pipe:1'
//     ]);

//     const chunks = [];
//     ffmpeg.stdout.on('data', (chunk) => chunks.push(chunk));
//     ffmpeg.stderr.on('data', (data) => {
//         // Log errors/info from FFmpeg if needed
//         // console.error(`FFmpeg Log: ${data}`);
//     });

//     ffmpeg.on('close', (code) => {
//       if (code === 0) {
//         resolve(Buffer.concat(chunks));
//       } else {
//         reject(new Error(`FFmpeg exited with code ${code}`));
//       }
//     });

//     ffmpeg.stdin.on('error', (err) => {
//         // Prevent app crash if FFmpeg closes stdin early
//         console.error('FFmpeg Stdin Error:', err);
//     });

//     // Feed the raw PCM buffer into FFmpeg
//     ffmpeg.stdin.write(pcmBuffer);
//     ffmpeg.stdin.end();
//   });
// }