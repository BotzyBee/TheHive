import OpenAI from 'openai';
import { makeSchemaStrict } from '../core/utils.js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { Services } from '../../index.js';
import { ModelTypes } from '../core/constants.js';

/**
 * Unified Deepseek call handler.
 * @param {string} systemMessage - Not needed for embeddings mode
 * @param {string | { text?: string, imageUrl?: string }} contentMessage  - not needed for embeddings mode
 * @param {string} model            - Target model (e.g., 'deepseek-chat', 'deepseek-coder')
 * @param {object} options
 * @param {object} [options.structuredOutput]   - If provided, uses structured output
 * @param {boolean} [options.embeddingsMode]  - If true, runs embeddings instead
 * @param {string[]} [options.inputDataVec]   - Required when capability is embedding
 * @param {number} [options.dimensionSize]    - Embeddings dimension override
 * @param {ModelTypes} [options.capability]    - What capability is required for the call (for routing)
 */
export async function callDeepseek(
  systemMessage,
  contentMessage,
  model,
  options = {}
) {
  Services.v2Core.Helpers.log(`Calling Deepseek : ${model}`);

  const { capability } = options;
  if (!capability) {
    return Services.v2Core.Helpers.Err(
      'Error (callDeepseek) : Capability param is missing or null. Ensure options.capability has valid ModelTypes'
    );
  }

  switch (capability) {
    case ModelTypes.text:
    case ModelTypes.code:
    case ModelTypes.reasoning:
      return await generateText(systemMessage, contentMessage, model, options);

    case ModelTypes.embedding:
      return await generateEmbeddings(model, options);

    case ModelTypes.image:
      return Services.v2Core.Helpers.Err(
        'Error (callDeepseek) : Deepseek image generation not implemented yet.'
      );

    case ModelTypes.websearch:
      return Services.v2Core.Helpers.Err(
        'Error (callDeepseek) : Deepseek websearch not implemented yet.'
      );

    case ModelTypes.textToSpeech:
      return Services.v2Core.Helpers.Err(
        'Error (callDeepseek) : Deepseek text to speech not implemented yet.'
      );

    case ModelTypes.speechToText:
      return Services.v2Core.Helpers.Err(
        'Error (callDeepseek) : Deepseek speech to text not implemented yet.'
      );

    case ModelTypes.deepResearch:
      return Services.v2Core.Helpers.Err(
        'Error (callDeepseek) : Deepseek deep research not implemented yet.'
      );

    case ModelTypes.maps:
      return Services.v2Core.Helpers.Err(
        'Error (callDeepseek) : Deepseek maps capability not implemented yet.'
      );

    case ModelTypes.local:
      return Services.v2Core.Helpers.Err(
        'Error (callDeepseek) : Deepseek local capability not implemented yet.'
      );

    default:
      return Services.v2Core.Helpers.Err(
        `Error (callDeepseek) : Capability "${capability}" not specifically handled for Deepseek.`
      );
  }
}

/**
 * Uses Deepseek to generate embeddings
 * @param {string} model - Model to use
 * @param {object} options - further options
 * @returns {Result}
 */
export async function generateEmbeddings(model, options = {}) {
  Services.v2Core.Helpers.log('Calling Deepseek -> generateEmbeddings');
  const apiKey = process.env.DPSK_KEY;
  const { inputDataVec, dimensionSize } = options;

  if (!Array.isArray(inputDataVec)) {
    return Services.v2Core.Helpers.Err(
      'Error: inputDataVec must be an array of strings.'
    );
  }

  try {
    const client = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.deepseek.com',
    });

    const payload = {
      model: model,
      input: inputDataVec,
    };

    if (dimensionSize) {
      payload.dimensions = dimensionSize;
    }

    const response = await client.embeddings.create(payload);

    // Extract the vector arrays from the response data
    const vectors = response.data.map((item) => item.embedding);
    return Services.v2Core.Helpers.Ok(vectors);
  } catch (error) {
    return Services.v2Core.Helpers.Err(
      `Error (callDeepseek -> generateEmbeddings): ${error.message || error}`
    );
  }
}

/**
 * Uses Deepseek to generate text
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
    return Services.v2Core.Helpers.Err(
      'Error (callDeepseek -> generateText): No model provided.'
    );
  }

  const apiKey = process.env.DPSK_KEY;
  const { structuredOutput } = options;

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://api.deepseek.com',
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
      image_url: { url: contentMessage.imageUrl },
    });
  } else {
    humanContent = contentMessage;
  }

  const messages = [
    { role: 'system', content: systemMessage },
    { role: 'user', content: humanContent },
  ];

  const requestPayload = {
    model: model,
    messages: messages,
  };

  // Configure structured outputs using the json_object approach
  if (structuredOutput) {
    const schemaWithStrictness = makeSchemaStrict(structuredOutput);

    // Deepseek requires explicit instructions in the prompt to output JSON
    const jsonInstructions = `\n\nYou must output your response in JSON format. Please ensure your response adheres to the following JSON schema:\n${JSON.stringify(schemaWithStrictness)}`;

    // Append instructions and schema to the system message
    messages[0].content += jsonInstructions;

    // Use the json_object response format
    requestPayload.response_format = {
      type: 'json_object',
    };
  }

  try {
    if (options.stream === true) {
      requestPayload.stream = true;
      const stream = await client.chat.completions.create(requestPayload);

      let fullContent = '';
      for await (const chunk of stream) {
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
    return Services.v2Core.Helpers.Err(
      `Error (callDeepseek -> generateText): ${error.message || error}`
    );
  }
}
