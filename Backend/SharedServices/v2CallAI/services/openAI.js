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
 * @param {string} model - Model to use (e.g., 'gpt-5', 'gpt-4.1', 'text-embedding-3-large')
 * @param {object} options
 * @param {object} [options.structuredOutput] - A valid JSON Schema object for structured outputs
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
      return await generateImage(contentMessage, model, options);

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
    const vectors = response.data.map((item) => item.embedding);

    return Services.v2Core.Helpers.Ok(vectors);
  } catch (error) {
    return Services.v2Core.Helpers.Err(
      `Error (callOpenAI -> generateEmbeddings): ${error?.message || error}`
    );
  }
}

/**
 * Uses OpenAI Responses endpoint to generate text, code, or structured JSON
 * @param {string} systemMessage - Instruction text mapped to instructions
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

  const { structuredOutput } = options;

  if (!model) {
    return Services.v2Core.Helpers.Err(
      'Error (callOpenAI -> generateText): No model provided.'
    );
  }

  try {
    let input;

    // Construct input for Responses API
    if (typeof contentMessage === 'string') {
      input = contentMessage.trim();
    } else if (typeof contentMessage === 'object' && contentMessage !== null) {
      const userContentArray = [];

      if (contentMessage.text) {
        userContentArray.push({
          type: 'input_text',
          text: contentMessage.text.trim(),
        });
      }

      if (contentMessage.imageUrl) {
        userContentArray.push({
          type: 'input_image',
          image_url: contentMessage.imageUrl,
        });
      }

      input =
        userContentArray.length > 0
          ? [
              {
                role: 'user',
                content: userContentArray,
              },
            ]
          : '';
    } else {
      input = '';
    }

    const payload = {
      model,
      input,
    };

    if (systemMessage?.trim()) {
      payload.instructions = systemMessage.trim();
    }

    // Structured outputs via Responses API
    if (structuredOutput) {
      const strictSchema = makeSchemaStrict(structuredOutput);

      payload.text = {
        format: {
          type: 'json_schema',
          name: 'structured_response',
          schema: strictSchema,
          strict: false,
        },
      };
    }

    const response = await client.responses.create(payload);

    // Handle refusals if present
    const refusal =
      response?.output
        ?.flatMap((item) => item.content || [])
        ?.find((item) => item.type === 'refusal')?.refusal || null;

    if (refusal) {
      return Services.v2Core.Helpers.Err(
        `Error (callOpenAI -> generateText): Model refused the request. Reason: ${refusal}`
      );
    }

    const text = response.output_text?.trim() ?? '';

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


/**
 * Generates an image using OpenAI
 * @param {string} contentMessage - Prompt for the AI to follow
 * @param {string} model - Model to use
 * @param {object} options - Further options
 * @param {object} [options.imageOptions]
 * @param {string} [options.imageOptions.size] - eg '1024x1024', '1536x1024', '1024x1536'
 * @returns {Result} - Result([ ImageMessage ])
 */
async function generateImage(contentMessage, model, options = {}) {
  if (!model) {
    return Services.v2Core.Helpers.Err(
      'Error (callOpenAI -> generateImage): No model provided.'
    );
  }

  const { imageOptions = {} } = options;
  const { size = '1024x1024' } = imageOptions;

  try {
    const response = await client.images.generate({
      model,
      prompt: contentMessage,
      size,
    });

    const responseMessages = (response.data || [])
      .filter(item => item.b64_json)
      .map(
        item =>
          new Services.aiAgents.Classes.ImageMessage({
            role: Services.aiAgents.Constants.Roles.Tool,
            mimeType: 'image/png',
            base64: item.b64_json,
          })
      );

    return Services.v2Core.Helpers.Ok(responseMessages);
  } catch (error) {
    return Services.v2Core.Helpers.Err(
      `Error (callOpenAI -> generateImage): ${error?.message || error}`
    );
  }
}