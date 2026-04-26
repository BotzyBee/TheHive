import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { Services } from '../../index.js';
import { ModelTypes } from '../core/constants.js';
import { makeSchemaStrict } from '../core/utils.js';

const client = new OpenAI({
  apiKey: process.env.OAI_KEY,
});

/**
 * Unified OpenAI call handler.
 * @param {string} systemMessage - System/developer instruction
 * @param {string | { text?: string, imageUrl?: string }} contentMessage - Prompt content
 * @param {string} model - Model to use (e.g., 'gpt-4o', 'o1', 'text-embedding-3-large')
 * @param {object} options
 * @param {object} [options.structuredOutput] - A valid JSON Schema object for Native Structured Outputs
 * @param {string[]} [options.inputDataVec] - Required when capability is embedding
 * @param {number} [options.dimensionSize] - Embeddings dimension override
 * @param {ModelTypes} [options.capability] - Capability required for routing
 */
export async function callOpenAI(
  systemMessage,
  contentMessage,
  model,
  options = {}
) {
  Services.v2Core.Helpers.log(`Calling OpenAI: ${model}`);
  const { capability } = options;

  if (!capability) {
    return Services.v2Core.Helpers.Err(
      'Error (callOpenAI): Capability param is missing or null. Ensure options.capability has valid ModelTypes'
    );
  }

  switch (capability) {
    case ModelTypes.text:
    case ModelTypes.code:
    case ModelTypes.reasoning:
      return await generateText(systemMessage, contentMessage, model, options);

    case ModelTypes.image:
      return Services.v2Core.Helpers.Err(
        'Error (callOpenAI): OpenAI image generation not implemented yet.'
      );

    case ModelTypes.deepResearch:
      return Services.v2Core.Helpers.Err(
        'Error (callOpenAI): OpenAI deep research not implemented yet.'
      );

    case ModelTypes.websearch:
      return Services.v2Core.Helpers.Err(
        'Error (callOpenAI): OpenAI websearch not implemented yet.'
      );

    case ModelTypes.embedding:
      return await generateEmbeddings(model, options);

    case ModelTypes.textToSpeech:
      return Services.v2Core.Helpers.Err(
        'Error (callOpenAI): OpenAI text to speech not implemented yet.'
      );

    case ModelTypes.speechToText:
      return Services.v2Core.Helpers.Err(
        'Error (callOpenAI): OpenAI speech to text not implemented yet.'
      );

    case ModelTypes.maps:
    case ModelTypes.local:
      return Services.v2Core.Helpers.Err(
        `Error (callOpenAI): ${capability} capability not available.`
      );

    default:
      return Services.v2Core.Helpers.Err(
        `Error (callOpenAI): "${capability}" not specifically handled.`
      );
  }
}

/**
 * Uses OpenAI to generate embeddings
 * @param {string} model - Model to use
 * @param {object} options
 * @returns {Result}
 */
export async function generateEmbeddings(model, options = {}) {
  Services.v2Core.Helpers.log('Calling OpenAI -> generateEmbeddings');

  const { inputDataVec, dimensionSize } = options;

  if (!model) {
    return Services.v2Core.Helpers.Err(
      'Error (callOpenAI -> generateEmbeddings): No model provided.'
    );
  }

  if (!Array.isArray(inputDataVec) || inputDataVec.length === 0) {
    return Services.v2Core.Helpers.Err(
      'Error (callOpenAI -> generateEmbeddings): inputDataVec must be a non-empty array of strings.'
    );
  }

  try {
    const payload = {
      model,
      input: inputDataVec,
    };

    if (dimensionSize) {
      payload.dimensions = dimensionSize;
    }

    const response = await client.embeddings.create(payload);
    const vectors = response.data.map(item => item.embedding);
    
    return Services.v2Core.Helpers.Ok(vectors);
  } catch (error) {
    return Services.v2Core.Helpers.Err(
      `Error (callOpenAI -> generateEmbeddings): ${error?.message || error}`
    );
  }
}

/**
 * Uses OpenAI Chat Completions endpoint to generate text, code, or structured JSON
 * @param {string} systemMessage - Instruction text mapped to system/developer role
 * @param {string | { text?: string, imageUrl?: string }} contentMessage - Prompt content
 * @param {string} model - Model to use
 * @param {object} options
 * @returns {Result}
 */
export async function generateText(
  systemMessage,
  contentMessage,
  model,
  options = {}
) {
  Services.v2Core.Helpers.log('Calling OpenAI -> generateText');

  const {
    structuredOutput,
  } = options;

  if (!model) {
    return Services.v2Core.Helpers.Err(
      'Error (callOpenAI -> generateText): No model provided.'
    );
  }

  try {
    const messages = [];

    // 1. Construct System Message
    if (systemMessage) {
      messages.push({ role: 'system', content: systemMessage.trim() });
    }

    // 2. Construct User Message (Handling Multimodal Vision Input)
    if (typeof contentMessage === 'string') {
      messages.push({ role: 'user', content: contentMessage.trim() });
    } else if (typeof contentMessage === 'object' && contentMessage !== null) {
      const userContentArray = [];
      if (contentMessage.text) {
        userContentArray.push({ type: 'text', text: contentMessage.text.trim() });
      }
      if (contentMessage.imageUrl) {
        userContentArray.push({
          type: 'image_url',
          image_url: { url: contentMessage.imageUrl },
        });
      }
      
      if (userContentArray.length > 0) {
        messages.push({ role: 'user', content: userContentArray });
      }
    }

    const payload = {
      model,
      messages,
    };


    // Implement Native Structured Outputs
    if (structuredOutput) {
      let strictSchema = makeSchemaStrict(structuredOutput);
      payload.response_format = {
        type: 'json_schema',
        json_schema: {
          name: 'structured_response',
          strict: true,
          schema: strictSchema,
        },
      };
    }

    // 5. Execute API Call
    const response = await client.chat.completions.create(payload);
    const responseMessage = response.choices?.[0]?.message;

    // Handle OpenAI safety filter refusals (common with structured outputs)
    if (responseMessage?.refusal) {
      return Services.v2Core.Helpers.Err(
        `Error (callOpenAI -> generateText): Model refused the request. Reason: ${responseMessage.refusal}`
      );
    }

    const text = responseMessage?.content?.trim() ?? '';

    // 6. Process output
    if (structuredOutput) {
      try {
        return Services.v2Core.Helpers.Ok(JSON.parse(text));
      } catch {
        return Services.v2Core.Helpers.Err(
          `Error (callOpenAI -> generateText): Failed to parse JSON. Raw output: ${text}`
        );
      }
    }

    return Services.v2Core.Helpers.Ok(text);
  } catch (error) {
    return Services.v2Core.Helpers.Err(
      `Error (callOpenAI -> generateText): ${error?.message || error}`
    );
  }
}