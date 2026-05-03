import axios from 'axios'; // Added axios
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { ModelTypes } from '../core/constants.js';
import { makeSchemaStrict } from '../core/utils.js';
import { Services } from '../../index.js';

/**
 * Unified Inception AI call handler.
 * @param {string} systemMessage - System instructions
 * @param {string} contentMessage - User prompt/content
 * @param {string} model - Model to use
 * @param {object} options
 * @param {ModelTypes} [options.capability] - What capability is required for the call (for routing)
 */
export async function callInception(
  systemMessage,
  contentMessage,
  model,
  options = {}
) {
  Services.v2Core.Helpers.log(`Calling Inception : ${model}`);
  const { capability } = options;

  if (!capability) {
    return Services.v2Core.Helpers.Err(
      'Error (callInception) : Capability param is missing or null. Ensure options.capability has valid ModelTypes'
    );
  }

  // Match Capabilities
  switch (capability) {
    case ModelTypes.text:
      return await generateText(systemMessage, contentMessage, model, options);

    case ModelTypes.code:
      return await generateText(systemMessage, contentMessage, model, options);

    case ModelTypes.image:
      return Services.v2Core.Helpers.Err(
        'Error (callInception) : Inception does not have image capability.'
      );

    case ModelTypes.reasoning:
      return await generateText(systemMessage, contentMessage, model, options);

    case ModelTypes.deepResearch:
      return Services.v2Core.Helpers.Err(
        'Error (callInception) : Inception does not have deep research capability.'
      );

    case ModelTypes.websearch:
      return Services.v2Core.Helpers.Err(
        'Error (callInception) : Inception does not have websearch capability.'
      );

    case ModelTypes.embedding:
      return Services.v2Core.Helpers.Err(
        'Error (callInception) : Inception does not have embedding capability.'
      );

    case ModelTypes.textToSpeech:
      return Services.v2Core.Helpers.Err(
        'Error (callInception) : Inception does not have text to speech capability.'
      );

    case ModelTypes.speechToText:
      return Services.v2Core.Helpers.Err(
        'Error (callInception) : Inception does not have speech to text capability.'
      );

    case ModelTypes.maps:
      return Services.v2Core.Helpers.Err(
        'Error (callInception) : Inception does not have maps capability.'
      );

    case ModelTypes.local:
      return Services.v2Core.Helpers.Err(
        'Error (callInception) : Inception does not have local capability.'
      );

    default:
      return Services.v2Core.Helpers.Err(
        `Error (callInception) "${capability}" not specifically handled.`
      );
  }
}

/**
 * Generates text using Inception AI
 * @param {string} systemMessage - System instructions
 * @param {string} contentMessage - Prompt for the AI to follow
 * @param {string} model - Model to use
 * @param {object} options - further options
 * @param {object} [options.structuredOutput] - A JSON schema object for structured output
 * @returns {Result} - Result wrapping the generated text response
 */
async function generateText(
  systemMessage,
  contentMessage,
  model,
  options = {}
) {
  Services.v2Core.Helpers.log(`Calling Inception Labs : ${model}`);
  if (!model) {
    return Services.v2Core.Helpers.Err(
      'Error (generateText): No model provided in options.'
    );
  }

  const apiKey = process.env.ICPTN_KEY;
  if (!apiKey) {
    return Services.v2Core.Helpers.Err(
      'Error (generateText): INCEPTION_API_KEY is not defined in environment variables.'
    );
  }

  // 1. Prepare the payload base
  const payload = {
    model: model,
    messages: [
      { role: 'system', content: systemMessage },
      { role: 'user', content: contentMessage },
    ],
  };

  // 2. Conditionally add structured output configuration
  if (options.structuredOutput) {
    let strictSchema = makeSchemaStrict(options.structuredOutput);
    payload.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'BotzyAI',
        strict: true,
        schema: strictSchema,
      },
    };
  }

  try {
    // Axios call: method, URL, data, config
    const response = await axios.post(
      'https://api.inceptionlabs.ai/v1/chat/completions',
      payload,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Axios automatically parses JSON and throws on non-2xx status codes
    const data = response.data;
    const content = data.choices?.[0]?.message?.content;
    // 3. If structured output was requested, parse the JSON string
    if (options.structuredOutput) {
      try {
        // AI often returns the JSON inside a string that needs parsing
        return Services.v2Core.Helpers.Ok(
          typeof content === 'string' ? JSON.parse(content) : content
        );
      } catch (e) {
        return Services.v2Core.Helpers.Err(
          `Error (generateText): Failed to parse structured output: ${e.message}`
        );
      }
    }

    return Services.v2Core.Helpers.Ok(content || '');
  } catch (error) {
    // Handle Axios-specific error object
    if (error.response) {
      // The server responded with a status code outside the 2xx range
      return Services.v2Core.Helpers.Err(
        `Error (generateText): Inception API responded with status ${error.response.status}. Details: ${JSON.stringify(error.response.data)}`
      );
    } else if (error.request) {
      // The request was made but no response was received
      return Services.v2Core.Helpers.Err(
        'Error (generateText): No response received from Inception API.'
      );
    } else {
      // Something else happened while setting up the request
      return Services.v2Core.Helpers.Err(
        `Error (generateText): ${error.message}`
      );
    }
  }
}
