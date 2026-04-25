import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { makeSchemaStrict } from '../core/utils.js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { Services } from '../../index.js';
import { ModelTypes } from '../core/constants.js';

/**
 * Models that are not compatible with ChatOpenAI / chat completions.
 * Add to this list if you discover more legacy completion-only models in use.
 */
function isLikelyCompletionOnlyModel(model) {
  if (!model || typeof model !== 'string') return false;

  const completionOnlyModels = [
    'text-davinci-003',
    'text-davinci-002',
    'text-curie-001',
    'text-babbage-001',
    'text-ada-001',
    'gpt-3.5-turbo-instruct',
  ];

  return completionOnlyModels.includes(model);
}

/**
 * Unified OpenAI call handler.
 * @param {string} systemMessage - Not needed for embeddings mode
 * @param {string | { text?: string, imageUrl?: string }} contentMessage - Not needed for embeddings mode
 * @param {string} model - Model name
 * @param {object} options
 * @param {object} [options.structuredOutput] - If provided, uses structured output
 * @param {boolean} [options.embeddingsMode] - If true, runs embeddings instead
 * @param {string[]} [options.inputDataVec] - Required when capability is embedding
 * @param {number} [options.dimensionSize] - Embeddings dimension override
 * @param {ModelTypes} [options.capability] - What capability is required for the call
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
      'Error (callOpenAI): Capability param is missing or null. Ensure options.capability has a valid ModelTypes value.'
    );
  }

  switch (capability) {
    case ModelTypes.text:
      return await generateText(systemMessage, contentMessage, model, options);

    case ModelTypes.code:
      return await generateText(systemMessage, contentMessage, model, options);

    case ModelTypes.image:
      return Services.v2Core.Helpers.Err(
        'Error (callOpenAI): OpenAI image generation not implemented yet.'
      );

    case ModelTypes.reasoning:
      return await generateText(systemMessage, contentMessage, model, options);

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
      return Services.v2Core.Helpers.Err(
        'Error (callOpenAI): Maps capability not available.'
      );

    case ModelTypes.local:
      return Services.v2Core.Helpers.Err(
        'Error (callOpenAI): Local capability not available.'
      );

    default:
      return Services.v2Core.Helpers.Err(
        `Error (callOpenAI): "${capability}" not specifically handled.`
      );
  }
}

/**
 * Uses OpenAI to generate embeddings.
 * @param {string} model - Model to use
 * @param {object} options - Further options
 * @returns {Result}
 */
export async function generateEmbeddings(model, options = {}) {
  Services.v2Core.Helpers.log('Calling OpenAI -> generateEmbeddings');

  const apiKey = process.env.OAI_KEY;
  const { inputDataVec, dimensionSize } = options;

  if (!model) {
    return Services.v2Core.Helpers.Err(
      'Error (callOpenAI -> generateEmbeddings): No model provided.'
    );
  }

  if (!Array.isArray(inputDataVec)) {
    return Services.v2Core.Helpers.Err(
      'Error (callOpenAI -> generateEmbeddings): inputDataVec must be an array of strings.'
    );
  }

  try {
    const embeddings = new OpenAIEmbeddings({
      model,
      dimensions: dimensionSize,
      openAIApiKey: apiKey,
    });

    const vectors = await embeddings.embedDocuments(inputDataVec);
    return Services.v2Core.Helpers.Ok(vectors);
  } catch (error) {
    return Services.v2Core.Helpers.Err(
      `Error (callOpenAI -> generateEmbeddings): ${error}`
    );
  }
}

/**
 * Uses OpenAI chat models to generate text.
 * @param {string} systemMessage - System message for the AI to follow
 * @param {string | { text?: string, imageUrl?: string }} contentMessage - Prompt/content for the AI
 * @param {string} model - Model to use
 * @param {object} options - Further options, optional
 * @param {object} [options.structuredOutput] - A JSON schema for structured outputs
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

  if (!model) {
    return Services.v2Core.Helpers.Err(
      'Error (callOpenAI -> generateText): No model provided.'
    );
  }

  if (isLikelyCompletionOnlyModel(model)) {
    return Services.v2Core.Helpers.Err(
      `Error (callOpenAI -> generateText): Model "${model}" is not a chat model and cannot be used with ChatOpenAI. Use a chat-capable model such as "gpt-4o-mini" or change your routing to use a completions client for legacy models.`
    );
  }

  const hasImage =
    contentMessage &&
    typeof contentMessage === 'object' &&
    contentMessage.imageUrl != null;

  const chatModel = new ChatOpenAI({
    model,
    openAIApiKey: apiKey,
  });

  let humanContent;

  if (hasImage) {
    humanContent = [
      ...(contentMessage.text
        ? [{ type: 'text', text: contentMessage.text }]
        : []),
      {
        type: 'image_url',
        image_url: { url: contentMessage.imageUrl },
      },
    ];
  } else if (
    contentMessage &&
    typeof contentMessage === 'object' &&
    contentMessage.text
  ) {
    humanContent = contentMessage.text;
  } else {
    humanContent = contentMessage;
  }

  const messages = [
    new SystemMessage(systemMessage),
    new HumanMessage(humanContent),
  ];

  try {
    if (structuredOutput) {
      const schemaWithStrictness = makeSchemaStrict(structuredOutput);
      const structured = chatModel.withStructuredOutput(schemaWithStrictness);
      const res = await structured.invoke(messages);
      return Services.v2Core.Helpers.Ok(res);
    }

    const res = await chatModel.invoke(messages);
    return Services.v2Core.Helpers.Ok(res.content);
  } catch (error) {
    return Services.v2Core.Helpers.Err(
      `Error (callOpenAI -> generateText): ${error}`
    );
  }
}