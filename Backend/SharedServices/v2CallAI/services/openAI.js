import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { makeSchemaStrict } from '../core/utils.js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { Services } from '../../index.js';
import { ModelTypes } from '../core/constants.js';

/**
 * Unified OpenAI call handler.
 * @param {string} systemMessage - Not needed for embeddings mode
 * @param {string | { text?: string, imageUrl?: string }} contentMessage  - not needed for embeddings mode
 * @param {object} options
 * @param {object} [options.structuredOutput]   - If provided, uses structured output
 * @param {string} [options.model]            - Override default model
 * @param {boolean} [options.embeddingsMode]  - If true, runs embeddings instead
 * @param {string[]} [options.inputDataVec]   - Required when embeddingsMode is true
 * @param {number} [options.dimensionSize]    - Embeddings dimension override
 * @param {ModelTypes} [options.capability]    - What capability is required for the call (for routing)
 */
export async function callOpenAI(
  systemMessage,
  contentMessage,
  model,
  options = {}
) {
  Services.v2Core.Helpers.log(`Calling Open AI : ${model}`);
  const { capability } = options;
  if (!capability) {
    return Services.v2Core.Helpers.Err('Error (callOpenAI) : Capability param is missing or null. Ensure options.capability has valid ModelTypes');
  }

  // Match Capabilities
  switch (capability) {
    case ModelTypes.text:
      return await generateText(systemMessage, contentMessage, model, options);

    case ModelTypes.code:
      return await generateText(systemMessage, contentMessage, model, options);

    case ModelTypes.image:
      return Services.v2Core.Helpers.Err('Error (callOpenAI) : OpenAI image generation not implemented yet.');

    case ModelTypes.reasoning:
      return await generateText(systemMessage, contentMessage, model, options);

    case ModelTypes.deepResearch:
      return Services.v2Core.Helpers.Err('Error (callOpenAI) : OpenAI deep research not implemented yet.');

    case ModelTypes.websearch:
      return Services.v2Core.Helpers.Err('Error (callOpenAI) : OpenAI websearch not implemented yet.');

    case ModelTypes.embedding:
      return await generateEmbeddings(model, options);

    case ModelTypes.textToSpeech:
      return Services.v2Core.Helpers.Err('Error (callOpenAI) : OpenAI text to speech not implemented yet.');

    case ModelTypes.speechToText:
      return Services.v2Core.Helpers.Err('Error (callOpenAI) : OpenAI speech to text not implemented yet.');

    case ModelTypes.maps:
      return Services.v2Core.Helpers.Err('Error (callOpenAI) : Maps capability not available.');

    case ModelTypes.local:
      return Services.v2Core.Helpers.Err('Error (callOpenAI) : Local capability not available.');

    default:
      return Services.v2Core.Helpers.Err(`Error (callOpenAI) "${capability}" not specifically handled.`);
  }
}

/**
 * Uses OpenAI to generate embeddings
 * @param {string} model - Model to use
 * @param {object} options - further options
 * @returns {Result}
 */
export async function generateEmbeddings(model, options = {}) {
  Services.v2Core.Helpers.log('Calling OpenAI -> generateEmbeddings');
  const apiKey = process.env.OAI_KEY;
  const { inputDataVec, dimensionSize } = options;
  if (!Array.isArray(inputDataVec)) {
    return Services.v2Core.Helpers.Err('Error: inputDataVec must be an array of strings.');
  }
  try {
    const embeddings = new OpenAIEmbeddings({
      model: model,
      dimensions: dimensionSize,
      openAIApiKey: apiKey,
    });
    const vectors = await embeddings.embedDocuments(inputDataVec);
    return Services.v2Core.Helpers.Ok(vectors);
  } catch (error) {
    return Services.v2Core.Helpers.Err(`Error (callOpenAI -> generateEmbeddings): ${error}`);
  }
}

/**
 * Uses OpenAI to generate text
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
  Services.v2Core.Helpers.log('Calling OpenAI -> generateText');
  const apiKey = process.env.OAI_KEY;
  const { structuredOutput } = options;
  // Validation: Ensure a model is provided
  if (!model) {
    return Services.v2Core.Helpers.Err('Error (callOpenAI -> generateText): No model provided in options.');
  }
  const hasImage = contentMessage?.imageUrl != null;
  const modelChoice = model;
  const chatModel = new ChatOpenAI({
    model: modelChoice,
    openAIApiKey: apiKey,
  });

  // Build message content - string for plain, array for multimodal
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
      const res = await chatModel.invoke(messages);
      return Services.v2Core.Helpers.Ok(res.content);
    }
  } catch (error) {
    return Services.v2Core.Helpers.Err(`Error (callOpenAI -> generateText): ${error}`);
  }
}
