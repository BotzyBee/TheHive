import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { makeSchemaStrict } from '../core/utils.js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { Services } from '../../index.js';

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
  console.log(`Calling Open AI : ${model}`);
  
  const apiKey = process.env.OAI_KEY;

  // --- Embeddings path ---
  if (options.embeddingsMode) {
    const { inputDataVec, dimensionSize } = options;
    if (!Array.isArray(inputDataVec)) {
      return Services.coreTools.Helpers.Err('Error: inputDataVec must be an array of strings.');
    }
    try {
      const embeddings = new OpenAIEmbeddings({
        model: model,
        dimensions: dimensionSize,
        openAIApiKey: apiKey,
      });
      const vectors = await embeddings.embedDocuments(inputDataVec);
      return Services.coreTools.Helpers.Ok(vectors);
    } catch (error) {
      return Services.coreTools.Helpers.Err(`Error (callOpenAI - embeddings): ${error}`);
    }
  }

  // --- Chat path ---
  const { structuredOutput } = options;
  // Validation: Ensure a model is provided
  if (!model) {
    return Services.coreTools.Helpers.Err('Error (callOpenAI): No model provided in options.');
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
      return Services.coreTools.Helpers.Ok(res);
    } else {
      const res = await chatModel.invoke(messages);
      return Services.coreTools.Helpers.Ok(res.content);
    }
  } catch (error) {
    return Services.coreTools.Helpers.Err(`Error (callOpenAI): ${error}`);
  }
}
