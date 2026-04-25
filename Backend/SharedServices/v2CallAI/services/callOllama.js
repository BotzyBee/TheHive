import axios from 'axios';
import { ModelTypes } from '../core/constants.js';
import { Services } from '../../index.js';

/**
 * Unified Ollama AI call handler.
 * @param {string} systemMessage - System instructions
 * @param {string} contentMessage - User prompt/content
 * @param {string} model - Model to use
 * @param {object} options
 * @param {ModelTypes} [options.capability] - What capability is required for the call (for routing)
 */
export async function callOllama(
  systemMessage,
  contentMessage,
  model,
  options = {}
) {
  Services.v2Core.Helpers.log(`Calling Ollama : ${model}`);
  const { capability } = options;

  if (!capability) {
    return Services.v2Core.Helpers.Err('Error (callOllama) : Capability param is missing or null. Ensure options.capability has valid ModelTypes');
  }

  // Match Capabilities
  switch (capability) {
    case ModelTypes.text:
      return await generateText(systemMessage, contentMessage, model, options);

    case ModelTypes.code:
      return await generateText(systemMessage, contentMessage, model, options);

    case ModelTypes.image:
      return Services.v2Core.Helpers.Err('Error (callOllama) : Ollama does not have image capability.');

    case ModelTypes.reasoning:
      return await generateText(systemMessage, contentMessage, model, options);

    case ModelTypes.deepResearch:
      return Services.v2Core.Helpers.Err('Error (callOllama) : Ollama does not have deep research capability.');

    case ModelTypes.websearch:
      return Services.v2Core.Helpers.Err('Error (callOllama) : Ollama does not have websearch capability.');

    case ModelTypes.embedding:
      return Services.v2Core.Helpers.Err('Error (callOllama) : Ollama does not have embedding capability.');

    case ModelTypes.textToSpeech:
      return Services.v2Core.Helpers.Err('Error (callOllama) : Ollama does not have text to speech capability.');

    case ModelTypes.speechToText:
      return Services.v2Core.Helpers.Err('Error (callOllama) : Ollama does not have speech to text capability.');

    case ModelTypes.maps:
      return Services.v2Core.Helpers.Err('Error (callOllama) : Ollama does not have maps capability.');

    case ModelTypes.local:
      return await generateText(systemMessage, contentMessage, model, options);

    default:
      return Services.v2Core.Helpers.Err(`Error (callOllama) "${capability}" not specifically handled.`);
  }
}

/**
 * Generates text using local Ollama API.
 * @param {string} systemMessage - System instructions
 * @param {string} contentMessage - Prompt for the AI to follow
 * @param {string} model - Model to use
 * @param {object} options - further options
 * @param {object} [options.structuredOutput] - A JSON schema object for structured output
 * @returns {Promise<object>} - Result wrapping the generated text or structured JSON.
 */
async function generateText(
  systemMessage,
  contentMessage,
  model,
  options = {}
) {
  if (!model || typeof model !== 'string') {
    return Services.v2Core.Helpers.Err('Error (generateText): A valid model string is required.');
  }

  if (!contentMessage || typeof contentMessage !== 'string') {
    return Services.v2Core.Helpers.Err('Error (generateText): A valid contentMessage string is required.');
  }

  const payload = {
    model: model.trim(),
    prompt: contentMessage.trim(),
    stream: false
  };

  let systemPrompt = systemMessage ? systemMessage.trim() : '';

  if (options.structuredOutput) {
    //payload.format = 'json';
    payload.format = options.structuredOutput;
    // const schemaStr = JSON.stringify(options.structuredOutput);
    // const jsonInstruction = `Respond EXACTLY with valid JSON matching this schema: ${schemaStr}`;
    // systemPrompt = systemPrompt ? `${systemPrompt}\n\n${jsonInstruction}` : jsonInstruction;
  }

  if (systemPrompt) {
    payload.system = systemPrompt;
  }

  try {
    const response = await axios.post('http://ollama:11434/api/generate', payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = response.data;
    const content = data.response;

    if (options.structuredOutput) {
      try {
        return Services.v2Core.Helpers.Ok(typeof content === 'string' ? JSON.parse(content) : content);
      } catch (parseError) {
        return Services.v2Core.Helpers.Err(`Error (generateText): Failed to parse structured output: ${parseError.message}`);
      }
    }

    return Services.v2Core.Helpers.Ok(content || '');
  } catch (error) {
    if (error.response) {
      return Services.v2Core.Helpers.Err(`Error (generateText): Ollama API responded with status ${error.response.status}. Details: ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      return Services.v2Core.Helpers.Err('Error (generateText): No response received from local Ollama API. Ensure Ollama is running on localhost:11434.');
    } else {
      return Services.v2Core.Helpers.Err(`Error (generateText): Request setup failed. Details: ${error.message}`);
    }
  }
}