import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { makeSchemaStrict } from '../core/utils.js';
import { Services } from '../../index.js';

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
  Services.v2Core.Helpers.log('Calling Anthropic...');
  
  const client = new Anthropic({
    apiKey: process.env.ANT_KEY,
  });
  const { structuredOutput } = options;
  // catch missing additionalProperties
  const schemaWithStrictness = makeSchemaStrict(structuredOutput);

  // Validation: Ensure a model is provided
  if (!model) {
    return Services.v2Core.Helpers.Err('Error (callClaude): No model provided in options.');
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
    return Services.v2Core.Helpers.Err(`Error (callClaude): ${error}`);
  }
}

