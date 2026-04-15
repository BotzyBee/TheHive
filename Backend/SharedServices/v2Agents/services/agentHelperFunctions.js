import { Services } from "../../index.js";
import path from 'path';

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
        return Services.v2Core.Helpers.Err(`Error ( callTool ) : toolName or filePath missing or null.`)
    }
    if (filePath == Services.fileSystem.Constants.builtInFilePath){
        // built-in tool
        let injectedDependencies = {
          ...Services,
        };
        // Not sure if this is needed anymore ??
        injectedDependencies.Helpers = {
            saveMessageContent,
            processBase64Audio_ToWavBuffer,
            callAgentTool
        };
        return Services.aiAgents.AgentTools[toolName].run(injectedDependencies, params, agentDependencies ); // tools must return Ok/ Err.
    } else {
        // plug-in tool
        let readFile = await import(/* @vite-ignore */ filePath);
        if(readFile){
            return readFile.run(injectedDependencies, params, agentDependencies);
        } else {
           return Services.v2Core.Helpers.Err(`Error ( callTool -> import ) : Could not read tool file - ${filePath}`); 
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
  if (!message || !folderPath) {
    return Services.v2Core.Helpers.Err(`Error (saveMessageContent): message or folderPath missing.`);
  }
  try {
    const fileRegistry = Services.fileSystem.IO.fileRegistry;
    let finalExtension;
    let strategyToUse;

    // Determine Extension and Strategy
    // Strip any leading dots to prevent ..txt etc
    const providedExt = message.ext ? message.ext.replace(/^\.+/, '') : null;

    if (providedExt) {
      finalExtension = providedExt;
      // Look up the I/O strategy directly using the provided extension
      strategyToUse = fileRegistry.getByExt(providedExt).strategy;
    } else {
      // Fallback to MIME type if no explicit extension is provided
      const mimeConfig = fileRegistry.getByMime(message.mime);
      finalExtension = mimeConfig.defaultExt;
      strategyToUse = mimeConfig.strategy;
    }

    const finalFileName = fileName 
      ? `${fileName}.${finalExtension}` 
      : `${message.id}.${finalExtension}`;

    const targetDirectory = path.join(Services.fileSystem.Constants.containerVolumeRoot, folderPath);

    // 2. Extract content dynamically based on priority
    let contentToSave = message.base64 || message.textData || message.data;

    // Handle URL-only Edge Case
    if (message.url && !contentToSave) {
       return Services.v2Core.Helpers.Err(`Error (saveMessageContent): Cannot save remote URL ${message.type} directly. Download required.`);
    }

    // Handle Empty/Null Content Edge Case
    if (!contentToSave) {
      // Fallback: Save the whole message object as JSON
      return await fileRegistry.getByExt("json").strategy.write(targetDirectory, message.toJSON(), `${message.id}.json`);
    }
    // Not supported
    if (!strategyToUse || !strategyToUse.write) {
      return Services.v2Core.Helpers.Err(`Error (saveMessageContent): Writing is not supported for extension '.${finalExtension}'`);
    }
    // Delegate to the Strategy's Write Method
    return await strategyToUse.write(targetDirectory, contentToSave, finalFileName);

  } catch (error) {
    return Services.v2Core.Helpers.Err(`Error (saveMessageContent): Exception: ${error.message}`);
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

/**
 * Normalizes image data into a Buffer for saving
 * Handles: Raw Base64, Data URLs (data:image/png;base64,...), and existing Buffers.
 * * @param {string|Buffer} input - The image data to process.
 * @returns {Buffer} - The processed binary buffer.
 */
export function prepareImageForSaving(input){
  // If it's already a Buffer, just hand it back.
  if (Buffer.isBuffer(input)) {
    return Services.v2Core.Helpers.Ok(input);
  }

  if (typeof input === 'string') {
    // Check for the "data:image/png;base64," prefix (Data URL)
    // We split by comma; if the prefix exists, the actual data is the second part.
    if (input.startsWith('data:')) {
      const base64Content = input.split(',')[1];
      return Services.v2Core.Helpers.Ok(Buffer.from(base64Content, 'base64'));
    }

    // Assume it's a raw Base64 string
    return Services.v2Core.Helpers.Ok(Buffer.from(input, 'base64'));
  }

  return Services.v2Core.Helpers.Err('Error (prepareImageForSaving) : Unsupported image format. Input must be a Base64 string or a Buffer.');
};

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