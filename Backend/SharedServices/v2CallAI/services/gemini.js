import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { GoogleGenAI } from '@google/genai';
import { makeSchemaStrict } from '../core/utils.js';
import { ModelTypes } from '../core/constants.js';
import { Services } from '../../index.js';

// Uses Google API not Langchain interface
// https://ai.google.dev/gemini-api/docs#javascript

/**
 * Unified Gemini AI call handler.
 * @param {string} systemMessage - System instructions
 * @param {string} contentMessage - User prompt/content
 * @param {object} options
 * @param {object} [options.structuredOutput] - If provided, returns parsed JSON via schema
 * @param {boolean} [options.useWeb]        - Enables Google Search grounding
 * @param {ModelTypes} [options.capability]    - What capability is required for the call (for routing)
 * @param {object} [options.imageOptions] - Object for image options
 * @param {string}  [options.imageOptions.aspectRatio] - eg 4:3 16:9 etc
 * @param {string}  [options.imageOptions.resolution] - 1K, 2K, 4K etc
 * @param {ImageMessage} [options.imageOptions.contextImage] - Image to be edited or used as part of the process.
 */
export async function callGemini(
  systemMessage,
  contentMessage,
  model,
  options = {}
) {
  console.log(`Calling Gemini : ${model}`);
  const { capability } = options;
  if(!capability){
    return Services.v2Core.Helpers.Err('Error (callGemini : Capability param is missing or null. Ensure options.capability has valid ModelTypes')
  }

  // Match Capabilities
  switch (capability) {
    case ModelTypes.text:
      return await generateText(systemMessage, contentMessage, model, options);

    case ModelTypes.code:
      return await generateText(systemMessage, contentMessage, model, options);

    case ModelTypes.image:
      return await generateImage(contentMessage, model, options);

    case ModelTypes.reasoning:
      return await generateText(systemMessage, contentMessage, model, options);

    case ModelTypes.deepResearch:
      return Services.v2Core.Helpers.Err('Error (callGemini) : Gemini does not have deep research capability.');

    case ModelTypes.websearch:
      return await generateText(systemMessage, contentMessage, model, options);

    case ModelTypes.embedding:
      return Services.v2Core.Helpers.Err('Error (callGemini) : Gemini does not have embedding capability.');

    case ModelTypes.textToSpeech:
      return await generateAudio(contentMessage, model, options);

    case ModelTypes.speechToText:
      return Services.v2Core.Helpers.Err('Error (callGemini) : Gemini does not have speech to text capability.');

    case ModelTypes.maps:
      return Services.v2Core.Helpers.Err('Error (callGemini) : Gemini does not have maps capability.');

    case ModelTypes.local:
      return Services.v2Core.Helpers.Err('Error (callGemini) : Gemini does not have local capability.');

    default:
      Services.v2Core.Helpers.Err(`Error (callGemini) "${capability}" not specifically handled.`);
  }
}

function processGrounding(apiResponse) {
  const candidate = apiResponse.candidates[0];
  let fullText = candidate.content.parts[0].text;
  const supports = candidate.groundingMetadata.groundingSupports;
  const chunks = candidate.groundingMetadata.groundingChunks;

  const usedReferences = [];
  const indexMap = new Map(); // Maps original API index -> new sequential index

  // Determine the order of appearance and create new indices
  // We sort ascending to see what appears first in the text
  const appearanceOrder = [...supports].sort((a, b) => a.segment.startIndex - b.segment.startIndex);

  appearanceOrder.forEach((support) => {
    const originalIndex = support.groundingChunkIndices[0];
    
    if (!indexMap.has(originalIndex)) {
      // If we haven't seen this source yet, assign it the next available number
      const newIndex = usedReferences.length;
      indexMap.set(originalIndex, newIndex);
      
      // Output the reference info for this chunk
      const chunk = chunks[originalIndex].web;
      usedReferences.push(chunk.uri);
    }
  });

  // 2. Insert the new numbers into the text
  // We sort descending to insert from back-to-front (prevents index shifting)
  const insertionOrder = [...supports].sort((a, b) => b.segment.startIndex - a.segment.startIndex);

  insertionOrder.forEach((support) => {
    const { endIndex } = support.segment;
    const originalIndex = support.groundingChunkIndices[0];
    const newIndex = indexMap.get(originalIndex);
    
    const refLabel = `[${newIndex}]`;
    fullText = fullText.slice(0, endIndex) + refLabel + fullText.slice(endIndex);
  });

  return {
    text: fullText,
    references: usedReferences
  };
}



// Generate Text 
/**
 * Uses Gemini to generate text
 * @param {string} systemMessage - System message for the AI to follow.
 * @param {string} contentMessage - Prompt for the AI to follow
 * @param {string} model - Model to use,, optional
 * @param {object} options - further options, optional
 * @param {boolean} [options.useWeb] - if true, AI uses web grounding.
 * @param {object}  [options.structuredOutput] - a JSON schema for structured outputs, optional.
 * @returns {Result} - Result( [ TextMessage, ...] )
 */
export async function generateText(
  systemMessage,
  contentMessage,
  model,
  options = {}
) {
  const gemiKey = process.env.GEM_KEY;
  const { structuredOutput, useWeb = false } = options;
  const schemaWithStrictness = makeSchemaStrict(structuredOutput);

  // Validation: Ensure a model is provided
  if (!model) {
    return Services.v2Core.Helpers.Err('Error (callGemini -> generateText): No model provided in options.');
  }
  const ai = new GoogleGenAI({ apiKey: gemiKey });

  // FOR DEBUG
  // let rootDir = Services.fileSystem.Constants.containerVolumeRoot;
  // let joined = Services.aiAgents.ToolHelpers.pathHelper.join(rootDir, "UserFiles/GemiTesting/");
  // let rndm = systemMessage.length + contentMessage.length; 
  // Services.fileSystem.CRUD.saveFile(joined, `System Prompt: \n\n ${systemMessage} \n\n ${contentMessage}`, `File_${rndm}.txt`);

  try {
    // ------------------------------------------------------------------
    // Case 1: Structured Output WITH Web Search (Requires 2-step process)
    // ------------------------------------------------------------------
    if (structuredOutput && useWeb) {
      // Step 1: Get grounded information (Streamed internally to prevent timeout)
      const firstResponseStream = await ai.models.generateContentStream({
        model: model,
        contents: [contentMessage],
        config: {
          tools: [{ googleSearch: {} }],
          systemInstruction: systemMessage,
        },
      });

      let firstPassText = "";
      for await (const chunk of firstResponseStream) {
        firstPassText += chunk.text; // Accumulate quietly
      }

      // Step 2: Format grounded info into JSON schema
      // This is usually fast enough not to timeout, so standard generateContent is fine
      const secondResponse = await ai.models.generateContent({
        model: model,
        contents: [firstPassText],
        config: {
          responseMimeType: 'application/json',
          responseSchema: schemaWithStrictness,
          systemInstruction:
            'Analyse the input text and convert it to the output schema. Do not add new thoughts or new research.',
        },
      });

      return Services.v2Core.Helpers.Ok(JSON.parse(secondResponse.text));
    }

    // ------------------------------------------------------------------
    // Case 2 & 3: Standard Chat or Structured Output (Single step)
    // ------------------------------------------------------------------
    const config = {
      systemInstruction: systemMessage,
    };

    if (useWeb) {
      config.tools = [{ googleSearch: {} }];
    }
    if (structuredOutput) {
      config.responseMimeType = 'application/json';
      config.responseSchema = schemaWithStrictness;
    }

    // Call the streaming endpoint
    const responseStream = await ai.models.generateContentStream({
      model: model,
      contents: [contentMessage],
      config: config,
    });

    let fullText = "";
    let finalCandidate = null;

    // Consume the stream internally
    for await (const chunk of responseStream) {
      // console.log("CHUNK :: ", chunk) // FOR DEBUG
      fullText += chunk.text;
      
      // The grounding metadata is usually attached to the final chunk's candidates array
      if (chunk.candidates && chunk.candidates.length > 0) {
        finalCandidate = chunk.candidates[0];
      }
    }

    // --- Stream Finished: Format and Return ---

    // Process Grounding if requested
    if (useWeb && finalCandidate && finalCandidate.groundingMetadata) {
      // Reconstruct an object that matches what your existing processGrounding expects
      const mockApiResponse = {
        candidates: [{
          content: { parts: [{ text: fullText }] },
          groundingMetadata: finalCandidate.groundingMetadata
        }]
      };
      
      const groundedResponse = processGrounding(mockApiResponse);
      return Services.v2Core.Helpers.Ok(groundedResponse);
    }

    // Parse JSON if Structured Output
    if (structuredOutput) {
      return Services.v2Core.Helpers.Ok(JSON.parse(fullText));
    }

    // Standard text completion
    return Services.v2Core.Helpers.Ok(fullText);

  } catch (error) {
    return Services.v2Core.Helpers.Err(`Error (callGemini -> generateText): ${error}`);
  }
}

// Generate Image - https://ai.google.dev/gemini-api/docs/image-generation#javascript
/**
 * Generates or edits images using Gemini
 * @param {string} contentMessage - Prompt for the AI to follow
 * @param {string} model - Model to use
 * @param {object} options - further options
 * @param {boolean} [options.useWeb] - if true, AI uses web grounding.
 * @param {object}  [options.imageOptions] - Object for further image options
 * @param {string}  [options.imageOptions.aspectRatio] - eg 4:3 16:9 etc
 * @param {string}  [options.imageOptions.resolution] - 1K, 2K, 4K etc
 * @param {ImageMessage} [options.imageOptions.contextImage] - Image to be edited or used as part of the process.
 * @returns {Result} - Result( [ ImageMessage ] )
 */
async function generateImage(
  contentMessage,
  model,
  options = {}
){
  if (!model) {
    return Services.v2Core.Helpers.Err('Error (callGemini -> generateImage): No model provided in options.');
  }
  const gemiKey = process.env.GEM_KEY;
  const ai = new GoogleGenAI({ apiKey: gemiKey });

  const { imageOptions = {}, useWeb = false } = options;
  const { aspectRatio = '4:3', resolution = '1K', contextImage } = imageOptions; 

  // Handle Context image
  let img = contextImage 
  ? { inlineData: { mimeType: contextImage.mime, data: contextImage.base64 } }
  : null;

  const contents = contextImage 
  ? [ { text: contentMessage } , ...img ] 
  : [ { text: contentMessage } ];
  const webTool = useWeb ? [{ googleSearch: {} }] : [];
  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: contents,
      config: {
        // responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: resolution,
        },
      tools: webTool,
      },
    });
    // Handle Response
    let responseMessages = [];
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const imageData = part.inlineData.data;
        let msg = new Services.aiAgents.Classes.ImageMessage({ 
          role: Services.aiAgents.Constants.Roles.Tool,
          mimeType: "image/png", 
          base64: imageData
        });
        responseMessages.push(msg);
      }
    }
    return Services.v2Core.Helpers.Ok(responseMessages);
  } catch (error) {
    return Services.v2Core.Helpers.Err(`Error (callGemini -> generateImage) : ${error}`)
  }
}

// https://ai.google.dev/gemini-api/docs/speech-generation
/** 
 * Generates audio (Text-to-Speech) using Gemini
 * @param {string} contentMessage - The text to be converted to speech
 * @param {string} model - Optional, TTS Model to use (e.g., "gemini-2.5-flash-preview-tts")
 * @param {object} options - further options
 * @param {boolean} [options.useWeb] - Optional, if true, AI uses web grounding
 * @param {object}  [options.ttsOptions] - Optional, Object for voice configurations
 * @param {string}  [options.ttsOptions.gender ] - Optional, [ "Male" | "Female" ] specify if male or female voice should be used.
 * @returns {Result} - Ok( [ AudioMessage ] )
 */
async function generateAudio( // TODO - * @param {object}  [options.speechOptions.multiSpeaker] - Configuration for multiple speakers
  contentMessage,
  model,
  options = {}
) {
  if (contentMessage == null) {
    return Services.v2Core.Helpers.Err('Error (callGemini -> generateAudio): No contentMessage provided.');
  }

  const gemiKey = process.env.GEM_KEY;
  const ai = new GoogleGenAI({ apiKey: gemiKey });

  const { ttsOptions = {}, useWeb = false } = options;
  const { gender, multiSpeaker = null } = ttsOptions;
  
  let voiceName = 'sadaltager'; // Male
  if(gender == "Female"){
    voiceName = 'despina';  // Female
  }

  // Example of MultiSpeaker (TO DO !)
  // multiSpeaker: {
  //    speakerVoiceConfigs: [{ speaker: 'Joe',
  //                          voiceConfig: {
  //                             prebuiltVoiceConfig: { voiceName: 'sadaltager' }
  //                          }
  //                       },
  //                       { speaker: 'Jane',
  //                          voiceConfig: {
  //                             prebuiltVoiceConfig: { voiceName: 'despina' } // Female
  //                          }
  //                       }
  //                 ]
  //                }

  // Set up the speech configuration
  const speechConfig = multiSpeaker 
    ? { multiSpeakerVoiceConfig: multiSpeaker }
    : {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voiceName },
        },
      };

  const contents = [{ parts: [{ text: contentMessage }] }];
  const webTool = useWeb ? [{ googleSearch: {} }] : [];

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: contents,
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: speechConfig,
        tools: webTool,
      },
    });

    let responseMessages = [];
    const candidates = response.candidates?.[0]?.content?.parts || [];

    for (const part of candidates) {
      // Extract audio data from inlineData
      if (part.inlineData) {
        let msg = new Services.aiAgents.Classes.AudioMessage({
          role: Services.aiAgents.Constants.Roles.Tool,
          mimeType: part.inlineData.mimeType || "audio/wav", // Default to wav for TTS stability
          base64: part.inlineData.data
        });
        responseMessages.push(msg);
      }
      
      // If the model also provides a transcript in the text part
      if (part.text && responseMessages.length > 0) {
        responseMessages[responseMessages.length - 1].transcript = part.text;
      }
    }

    return Services.v2Core.Helpers.Ok(responseMessages);
  } catch (error) {
    return Services.v2Core.Helpers.Err(`Error (callGemini -> generateAudio) : ${error.message || error}`);
  }
}