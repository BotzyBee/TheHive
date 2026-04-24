import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { makeSchemaStrict } from '../core/utils.js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { Services } from '../../index.js';
import { ModelTypes } from '../core/constants.js';

/**
 * Unified Kimi (Moonshot AI) call handler.
 * @param {string} systemMessage - Not needed for embeddings mode
 * @param {string | { text?: string, imageUrl?: string }} contentMessage  - not needed for embeddings mode
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
    const embeddings = new OpenAIEmbeddings({
      model: model,
      dimensions: dimensionSize,
      openAIApiKey: apiKey,
      configuration: {
        baseURL: 'https://api.moonshot.ai/v1'
      }
    });

    const vectors = await embeddings.embedDocuments(inputDataVec);
    return Services.v2Core.Helpers.Ok(vectors);
  } catch (error) {
    return Services.v2Core.Helpers.Err(`Error (callKimi -> generateEmbeddings): ${error}`);
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

  const chatModel = new ChatOpenAI({
    model: model,
    openAIApiKey: apiKey,
    configuration: {
      baseURL: 'https://api.moonshot.ai/v1'
    },
    streaming: options.stream === true
  });

  const hasImage = contentMessage?.imageUrl != null;
  let humanContent;

  if (hasImage) {
    humanContent = [
      ...(contentMessage.text
        ? [{ type: 'text', text: contentMessage.text }]
        : []),
      { type: 'image_url', image_url: { url: contentMessage.imageUrl } },
    ];
  } else {
    humanContent = contentMessage;
  }

  const messages = [
    new SystemMessage(systemMessage),
    new HumanMessage(hasImage ? { content: humanContent } : humanContent),
  ];

  try {
    if (structuredOutput) {
      const schemaWithStrictness = makeSchemaStrict(structuredOutput);
      const structured = chatModel.withStructuredOutput(schemaWithStrictness);
      const res = await structured.invoke(messages);
      return Services.v2Core.Helpers.Ok(res);
    } else {
      if (options.stream) {
        const stream = await chatModel.stream(messages);
        let fullContent = '';
        for await (const chunk of stream) {
          const content = chunk.content;
          if (content) {
            fullContent += content;
            if (options.onChunk) {
              options.onChunk(content);
            }
          }
        }
        return Services.v2Core.Helpers.Ok(fullContent);
      } else {
        const res = await chatModel.invoke(messages);
        return Services.v2Core.Helpers.Ok(res.content);
      }
    }
  } catch (error) {
    return Services.v2Core.Helpers.Err(`Error (callKimi -> generateText): ${error}`);
  }
}
