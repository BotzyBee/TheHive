import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { SharedUtils } from '../Utils/index.js';
import { makeSchemaStrict } from './index.js';

let su = new SharedUtils();

/**
 * Unified Claude AI call handler.
 * @param {string} systemMessage - System instructions
 * @param {string} contentMessage - User prompt/content
 * @param {object} options
 * @param {object} [options.structuredOutput] - If provided, returns parsed JSON via schema
 * @param {boolean} [options.capability]    - What capability is required for the call (for routing)
 */
export async function callAnthropic(
  systemMessage,
  contentMessage,
  model,
  options = {}
) {
  su.log('Calling Anthropic...');
  dotenv.config({ path: '.env' });
  const client = new Anthropic({
    apiKey: process.env.ANT_KEY,
  });
  const { structuredOutput } = options;
  // catch missing additionalProperties
  const schemaWithStrictness = makeSchemaStrict(structuredOutput);

  // Validation: Ensure a model is provided
  if (!model) {
    return su.logAndErr('Error (callClaude): No model provided in options.');
  }
  try {
    const params = {
      model: model,
      max_tokens: 4096,
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
    // Find the first text block in the content array
    const textBlock = res.content.find((block) => block.type === 'text');
    if (!textBlock) {
      return su.logAndErr('No text content returned from Claude.');
    }
    const finalResult = structuredOutput
      ? JSON.parse(textBlock.text)
      : textBlock.text;

    return su.result_ok(finalResult);
  } catch (error) {
    return su.logAndErr(`Error (callClaude): ${error}`);
  }
}
