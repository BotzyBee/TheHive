import * as su from '../Utils/index.js';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { makeSchemaStrict } from './index.js';
import { ModelTypes } from '../constants.js';
import { ImageMessage, AudioMessage } from '../Classes/aiMessages.js';
import { Services } from '../index.js';

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
  su.log(`Calling Gemini : ${model}`);
  const { capability } = options;
  if(!capability){
    return su.Err('Error (callGemini : Capability param is missing or null. Ensure options.capability has valid ModelTypes')
  }

  // Match Capabilities
  switch (capability) {
    case ModelTypes.text:
      return await generateText(systemMessage, contentMessage, model, options);

    case ModelTypes.code:
      return su.Err('Error (callGemini) : Gemini does not have coding capability.');

    case ModelTypes.image:
      return await generateImage(contentMessage, model, options);

    case ModelTypes.reasoning:
      return await generateText(systemMessage, contentMessage, model, options);

    case ModelTypes.deepResearch:
      return su.Err('Error (callGemini) : Gemini does not have deep research capability.');

    // case ModelTypes.structuredOutputs:
    //   // Enforce JSON schema response
    //   return await handleStructuredOutput(systemMessage, contentMessage, model, structuredOutput);

    case ModelTypes.websearch:
      return await generateText(systemMessage, contentMessage, model, options);

    case ModelTypes.embedding:
      return su.Err('Error (callGemini) : Gemini does not have embedding capability.');

    case ModelTypes.textToSpeech:
      return await generateAudio(contentMessage, model, options);

    case ModelTypes.speechToText:
      return su.Err('Error (callGemini) : Gemini does not have speech to text capability.');

    case ModelTypes.maps:
      return su.Err('Error (callGemini) : Gemini does not have maps capability.');

    case ModelTypes.local:
      return su.Err('Error (callGemini) : Gemini does not have local capability.');

    default:
      su.Err(`Error (callGemini) "${capability}" not specifically handled.`);
  }
}

// Generate Text 
async function generateText(
  systemMessage,
  contentMessage,
  model,
  options = {}
){
  dotenv.config({ path: '.env' });
  const gemiKey = process.env.GEM_KEY;
  const { structuredOutput, useWeb = false } = options;
  const schemaWithStrictness = makeSchemaStrict(structuredOutput); // enforce strictness;

  // Validation: Ensure a model is provided
  if (!model) {
    return su.logAndErr('Error (callGemini -> generateText): No model provided in options.');
  }
  const ai = new GoogleGenAI({ apiKey: gemiKey });

  try {
    // Case 1: Structured Output WITH Web Search (Requires 2-step process)
    if (structuredOutput && useWeb) {
      // First call: Get grounded information
      const firstResponse = await ai.models.generateContent({
        model: model,
        contents: [contentMessage],
        config: {
          tools: [{ googleSearch: {} }],
          systemInstruction: systemMessage,
        },
      });
      
      // Second call: Format grounded info into JSON schema
      const secondResponse = await ai.models.generateContent({
        model: model,
        contents: [firstResponse.text],
        config: {
          responseMimeType: 'application/json',
          responseSchema: schemaWithStrictness,
          systemInstruction:
            'Analyse the input text and convert it to the output schema. Do not add new thoughts or new research.',
        },
      });

      return su.Ok(JSON.parse(secondResponse.text));
    }

    // Case 2 & 3: Standard Chat or Structured Output (Single step)
    const config = {
      systemInstruction: systemMessage,
    };

    // Add Web Search tool if requested (and not handled by Case 1)
    if (useWeb) {
      config.tools = [{ googleSearch: {} }];
    }

    // Add JSON schema if requested
    if (structuredOutput) {
      config.responseMimeType = 'application/json';
      config.responseSchema = schemaWithStrictness;
    }

    const response = await ai.models.generateContent({
      model: model,
      contents: [contentMessage],
      config: config,
    });

    const finalResult = structuredOutput
      ? JSON.parse(response.text)
      : response.text;

    return su.Ok(finalResult);
  } catch (error) {
    return su.logAndErr(`Error (callGemini -> generateText): ${error}`);
  }
}

// Generate Image - https://ai.google.dev/gemini-api/docs/image-generation#javascript
/**
 * Generates or edits images using AI
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
    return su.Err('Error (callGemini -> generateImage): No model provided in options.');
  }
  dotenv.config({ path: '.env' });
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
        let msg = new ImageMessage({ 
          role: Services.Classes.Roles.Tool,
          mimeType: "image/png", 
          base64: imageData
        });
        responseMessages.push(msg);
      }
    }
    return su.Ok(responseMessages);
  } catch (error) {
    return su.Err(`Error (callGemini -> generateImage) : ${error}`)
  }
}

/**
 * Generates audio (Text-to-Speech) using AI
 * @param {string} contentMessage - The text to be converted to speech
 * @param {string} model - Optional, TTS Model to use (e.g., "gemini-2.5-flash-preview-tts")
 * @param {object} options - further options
 * @param {boolean} [options.useWeb] - Optional, if true, AI uses web grounding
 * @param {object}  [options.speechOptions] - Optional, Object for voice configurations
 * @param {string}  [options.speechOptions.voiceName] - Optional, Built in voices to use (e.g., 'Kore', 'Puck')
 * @returns {Result} - Ok( [ AudioMessage ] )
 */
export async function generateAudio( // TODO - * @param {object}  [options.speechOptions.multiSpeaker] - Configuration for multiple speakers
  contentMessage,
  model,
  options = {}
) {
  if (contentMessage == null) {
    return su.Err('Error (callGemini -> generateAudio): No contentMessage provided.');
  }

  dotenv.config({ path: '.env' });
  const gemiKey = process.env.GEM_KEY;
  const ai = new GoogleGenAI({ apiKey: gemiKey });

  const { speechOptions = {}, useWeb = false } = options;
  const { voiceName = 'sadaltager', multiSpeaker = null } = speechOptions;
  
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
        let msg = new AudioMessage({
          role: Services.Classes.Roles.Tool,
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

    return su.Ok(responseMessages);
  } catch (error) {
    return su.Err(`Error (callGemini -> generateAudio) : ${error.message || error}`);
  }
}