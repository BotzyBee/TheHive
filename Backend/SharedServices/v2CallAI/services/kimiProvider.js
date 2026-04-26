import OpenAI from 'openai';
import { makeSchemaStrict } from '../core/utils.js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { Services } from '../../index.js';
import { ModelTypes } from '../core/constants.js';

/**
 * Unified Kimi (Moonshot AI) call handler.
 * @param {string} systemMessage - Not needed for embeddings mode
 * @param {string | { text?: string, imageUrl?: string }} contentMessage  - Not needed for embeddings mode
 * @param {string} model            - Target model
 * @param {object} options
 * @param {object} [options.structuredOutput]   - If provided, uses structured output
 * @param {boolean} [options.embeddingsMode]  - If true, runs embeddings instead
 * @param {string[]} [options.inputDataVec]   - Required when capability is embedding
 * @param {number} [options.dimensionSize]    - Embeddings dimension override
 * @param {ModelTypes} [options.capability]    - What capability is required for the call (for routing)
 */
export async function callKimi(
  systemMessage,
  contentMessage,
  model,
  options = {}
) {
  Services.v2Core.Helpers.log(`Calling Kimi : ${model}`);

  const { capability } = options;
  if (!capability) {
    return Services.v2Core.Helpers.Err('Error (callKimi) : Capability param is missing or null. Ensure options.capability has valid ModelTypes');
  }

  switch (capability) {
    case ModelTypes.text:
    case ModelTypes.code:
    case ModelTypes.reasoning:
      return await generateText(systemMessage, contentMessage, model, options);

    case ModelTypes.embedding:
      return await generateEmbeddings(model, options);

    case ModelTypes.image:
      return Services.v2Core.Helpers.Err('Error (callKimi) : Kimi image generation not implemented yet.');

    case ModelTypes.websearch:
      return Services.v2Core.Helpers.Err('Error (callKimi) : Kimi websearch not implemented yet.');

    case ModelTypes.textToSpeech:
      return Services.v2Core.Helpers.Err('Error (callKimi) : Kimi text to speech not implemented yet.');

    case ModelTypes.speechToText:
      return Services.v2Core.Helpers.Err('Error (callKimi) : Kimi speech to text not implemented yet.');

    case ModelTypes.deepResearch:
      return Services.v2Core.Helpers.Err('Error (callKimi) : Kimi deep research not implemented yet.');

    case ModelTypes.maps:
      return Services.v2Core.Helpers.Err('Error (callKimi) : Kimi maps capability not implemented yet.');

    case ModelTypes.local:
      return Services.v2Core.Helpers.Err('Error (callKimi) : Kimi local capability not implemented yet.');

    default:
      return Services.v2Core.Helpers.Err(`Error (callKimi) : Capability "${capability}" not specifically handled for Kimi.`);
  }
}

/**
 * Uses Kimi to generate embeddings
 * @param {string} model - Model to use
 * @param {object} options - further options
 * @returns {Result}
 */
export async function generateEmbeddings(model, options = {}) {
  Services.v2Core.Helpers.log('Calling Kimi -> generateEmbeddings');
  const apiKey = process.env.KIMI_KEY;
  const { inputDataVec, dimensionSize } = options;

  if (!Array.isArray(inputDataVec)) {
    return Services.v2Core.Helpers.Err('Error: inputDataVec must be an array of strings.');
  }

  try {
    const client = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.moonshot.ai/v1'
    });

    const payload = {
      model: model,
      input: inputDataVec
    };

    if (dimensionSize) {
      payload.dimensions = dimensionSize;
    }

    const response = await client.embeddings.create(payload);
    
    // Extract the vector arrays from the response data
    const vectors = response.data.map((item) => item.embedding);
    return Services.v2Core.Helpers.Ok(vectors);
  } catch (error) {
    return Services.v2Core.Helpers.Err(`Error (callKimi -> generateEmbeddings): ${error.message || error}`);
  }
}

/**
 * Uses Kimi to generate text
 * @param {*} systemMessage - System message for the AI to follow.
 * @param {string | object} contentMessage - Prompt for the AI to follow
 * @param {string} model - Model to use
 * @param {object} options - further options, optional
 * @param {object}  [options.structuredOutput] - a JSON schema for structured outputs, optional.
 * @returns {Result}
 */
export async function generateText(
  systemMessage,
  contentMessage,
  model,
  options = {}
) {
  if (!model) {
    return Services.v2Core.Helpers.Err('Error (callKimi -> generateText): No model provided.');
  }

  const apiKey = process.env.KIMI_KEY;
  const { structuredOutput } = options;

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://api.moonshot.ai/v1'
  });

  const hasImage = contentMessage?.imageUrl != null;
  let humanContent;

  if (hasImage) {
    humanContent = [];
    if (contentMessage.text) {
      humanContent.push({ type: 'text', text: contentMessage.text });
    }
    humanContent.push({
      type: 'image_url',
      image_url: { url: contentMessage.imageUrl }
    });
  } else {
    humanContent = contentMessage;
  }

  const messages = [
    { role: 'system', content: systemMessage },
    { role: 'user', content: humanContent }
  ];

  const requestPayload = {
    model: model,
    messages: messages,
  };

  // Configure structured outputs using the standard JSON schema approach
  if (structuredOutput) {
    const schemaWithStrictness = makeSchemaStrict(structuredOutput);
    requestPayload.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'structured_response',
        strict: true,
        schema: schemaWithStrictness
      }
    };
  }

  try {
    if (options.stream === true) {
      requestPayload.stream = true;
      const stream = await client.chat.completions.create(requestPayload);
      
      let fullContent = '';
      for await (const chunk of stream) {
        // Delta content can be undefined when the stream finishes
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          fullContent += content;
          if (options.onChunk) {
            options.onChunk(content);
          }
        }
      }

      if (structuredOutput) {
        return Services.v2Core.Helpers.Ok(JSON.parse(fullContent));
      }
      return Services.v2Core.Helpers.Ok(fullContent);

    } else {
      const response = await client.chat.completions.create(requestPayload);
      const responseContent = response.choices[0]?.message?.content || '';

      if (structuredOutput) {
        return Services.v2Core.Helpers.Ok(JSON.parse(responseContent));
      }
      return Services.v2Core.Helpers.Ok(responseContent);
    }
  } catch (error) {
    return Services.v2Core.Helpers.Err(`Error (callKimi -> generateText): ${error.message || error}`);
  }
}