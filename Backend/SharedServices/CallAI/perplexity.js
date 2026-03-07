import axios from 'axios';
import dotenv from 'dotenv';
import * as su from '../Utils/index.js';

/**
 * Unified Perplexity AI call handler (Synchronous only).
 * * @param {string} systemMessage
 * @param {string} contentMessage
 * @param {object} options
 * @param {string} options.model            - Required: The specific Perplexity model to use
 * @param {object} [options.structuredOutput] - If provided, returns parsed JSON
 * @param {string[]} [options.domains]      - Array of domains to include/exclude (max 20)
 * @param {boolean} [options.capability]    - What capability is required for the call (for routing)
 */
export async function callPerplexity(
  systemMessage,
  contentMessage,
  model,
  options = {}
) {
  su.log(`Calling Perplexity : ${model}`);
  dotenv.config({ path: '.env' });
  const ppxAPI = process.env.PXY_KEY;

  const { structuredOutput, domains = [] } = options;

  // Validation: Ensure a model is provided
  if (!model) {
    return su.logAndErr(
      'Error (callPerplexity): No model provided in options.'
    );
  }

  const url = 'https://api.perplexity.ai/chat/completions';
  const headers = {
    Authorization: `Bearer ${ppxAPI}`,
    'Content-Type': 'application/json',
  };

  // Domain filter safety (Perplexity API limit is 20)
  const domainFilter = Array.isArray(domains) ? domains.slice(0, 20) : [];

  const payload = {
    model: model,
    messages: [
      { role: 'system', content: systemMessage },
      { role: 'user', content: contentMessage },
    ],
    search_domain_filter: domainFilter,
  };

  // Inject structured output format if schema is present
  if (structuredOutput) {
    payload.response_format = {
      type: 'json_schema',
      json_schema: { schema: structuredOutput },
    };
  }

  try {
    const response = await axios.post(url, payload, { headers });
    const data = response.data;
    let content = data.choices[0].message.content;

    // Parse JSON if we requested structured output
    if (structuredOutput) {
      try {
        content = JSON.parse(content);
      } catch (e) {
        return su.logAndErr(
          'Error (callPerplexity): Could not parse response to JSON.'
        );
      }
    }

    return su.Ok({
      searchResult: content,
      citations: data.citations || [],
    });
  } catch (error) {
    // Return detailed error if possible, otherwise generic message
    const errorMsg =
      error.response?.data?.error?.message || error.message || error;
    return su.logAndErr(`Error (callPerplexity): ${errorMsg}`);
  }
}
