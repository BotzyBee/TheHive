import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { makeSchemaStrict } from '../core/utils.js';
import { Services } from '../../index.js';
import { ModelTypes } from '../core/constants.js';

/**
 * Unified Claude AI call handler.
 * @param {string} systemMessage - System instructions
 * @param {string} contentMessage - User prompt/content
 * @param {object} options
 * @param {object} [options.structuredOutput] - If provided, returns parsed JSON via schema
 * @param {ModelTypes} [options.capability]    - What capability is required for the call (for routing)
 */
export async function callAnthropic(
  systemMessage,
  contentMessage,
  model,
  options = {}
) {
  Services.v2Core.Helpers.log(`Calling Anthropic : ${model}`);
  const { capability } = options;
  if(!capability){
    return Services.v2Core.Helpers.Err('Error (callAnthropic) : Capability param is missing or null. Ensure options.capability has valid ModelTypes');
  }

  // Match Capabilities
  switch (capability) {
    case ModelTypes.text:
      return await generateText(systemMessage, contentMessage, model, options);

    case ModelTypes.code:
      return await generateText(systemMessage, contentMessage, model, options);

    case ModelTypes.image:
      return Services.v2Core.Helpers.Err('Error (callAnthropic) : Anthropic does not have image capability.');

    case ModelTypes.reasoning:
      return await generateText(systemMessage, contentMessage, model, options);

    case ModelTypes.deepResearch:
      return Services.v2Core.Helpers.Err('Error (callAnthropic) : Anthropic does not have deep research capability.');

    case ModelTypes.websearch:
      return Services.v2Core.Helpers.Err('Error (callAnthropic) : Anthropic does not have websearch capability.');

    case ModelTypes.embedding:
      return Services.v2Core.Helpers.Err('Error (callAnthropic) : Anthropic does not have embedding capability.');

    case ModelTypes.textToSpeech:
      return Services.v2Core.Helpers.Err('Error (callAnthropic) : Anthropic does not have text to speech capability.');

    case ModelTypes.speechToText:
      return Services.v2Core.Helpers.Err('Error (callAnthropic) : Anthropic does not have speech to text capability.');

    case ModelTypes.maps:
      return Services.v2Core.Helpers.Err('Error (callAnthropic) : Anthropic does not have maps capability.');

    case ModelTypes.local:
      return Services.v2Core.Helpers.Err('Error (callAnthropic) : Anthropic does not have local capability.');

    default:
      return Services.v2Core.Helpers.Err(`Error (callAnthropic) "${capability}" not specifically handled.`);
  }
}

/**
 * Uses Anthropic to generate text
 * @param {*} systemMessage - System message for the AI to follow.
 * @param {string} contentMessage - Prompt for the AI to follow
 * @param {string} model - Model to use
 * @param {object} options - further options, optional
 * @param {object}  [options.structuredOutput] - a JSON schema for structured outputs, optional.
 * @returns {Result} - Result( [ TextMessage, ...] )
 */
export async function generateText(
  systemMessage,
  contentMessage,
  model,
  options = {}
) {
  Services.v2Core.Helpers.log('Calling Anthropic -> generateText');
  const client = new Anthropic({
    apiKey: process.env.ANT_KEY,
  });
  const { structuredOutput } = options;
  // catch missing additionalProperties
  const schemaWithStrictness = makeSchemaStrict(structuredOutput);

  // Validation: Ensure a model is provided
  if (!model) {
    return Services.v2Core.Helpers.Err('Error (callAnthropic -> generateText): No model provided in options.');
  }
  try {
    const params = {
      model: model,
      max_tokens: 8192,
      system: systemMessage,
      messages: [{ role: 'user', content: contentMessage }],
    };

    // Add structured output config if schema is provided
    if (structuredOutput) {
      params.output_config = {
        format: {
          type: 'json_schema',
          schema: schemaWithStrictness,
        },
      };
    }
    const res = await client.messages.create(params);

    // Check if the model cut off early
    if (res.stop_reason === 'max_tokens') {
      return Services.v2Core.Helpers.Err('Error: Claude hit the max_token limit. The JSON is incomplete.');
    }

    // Find the first text block in the content array
    const textBlock = res.content.find((block) => block.type === 'text');
    if (!textBlock) {
      return Services.v2Core.Helpers.Err('No text content returned from Claude.');
    }

    let finalResult;
    if (structuredOutput) {
        try {
          finalResult = JSON.parse(textBlock.text);
        } catch (e) {
          console.error("Failed to parse JSON. String preview:", textBlock.text.slice(-100)); // See the end of the string
          return Services.v2Core.Helpers.Err(`JSON Syntax Error at position ${e.message}`);
        }
      } else {
        finalResult = textBlock.text;
    }

    return Services.v2Core.Helpers.Ok(finalResult);
  } catch (error) {
    console.error('Anthropic ERROR DEBUG :', JSON.stringify(schemaWithStrictness, null, 2));
    return Services.v2Core.Helpers.Err(`Error (callAnthropic -> generateText): ${error}`);
  }
}

