import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { Services } from '../../index.js';


/**
 * Unified Perplexity AI call handler (Internal Streaming).
 * Consumes the stream internally and returns the final concatenated result.
 */
export async function callPerplexity(
  systemMessage,
  contentMessage,
  model,
  options = {}
) {
  console.log(`Calling Perplexity: ${model}`);
  
  const ppxAPI = process.env.PXY_KEY;
  const { structuredOutput, domains = [] } = options;

  if (!model) {
    return Services.v2Core.Helpers.Err('Error: No model provided.');
  }

  const url = 'https://api.perplexity.ai/chat/completions';
  const payload = {
    model: model,
    messages: [
      { role: 'system', content: systemMessage },
      { role: 'user', content: contentMessage },
    ],
    search_domain_filter: Array.isArray(domains) ? domains.slice(0, 20) : [],
    stream: true, // Enable streaming
  };

  if (structuredOutput) {
    payload.response_format = {
      type: 'json_schema',
      json_schema: { schema: structuredOutput },
    };
  }

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${ppxAPI}`,
        'Content-Type': 'application/json',
      },
      responseType: 'stream', // Tells axios to treat this as a stream
    });

    let fullContent = '';
    let finalCitations = [];

    return new Promise((resolve, reject) => {
      response.data.on('data', (chunk) => {
        // Convert buffer to string
        const lines = chunk.toString().split('\n');

        for (const line of lines) {
          const message = line.replace(/^data: /, '').trim();

          if (message === '' || message === '[DONE]') continue;

          try {
            const parsed = JSON.parse(message);
            const delta = parsed.choices[0]?.delta?.content || "";
            fullContent += delta;

            // Citations usually come in the final chunks or update as they go
            if (parsed.citations) {
              finalCitations = parsed.citations;
            }
          } catch (e) {
            // Ignore partial or non-JSON lines
          }
        }
      });

      response.data.on('end', () => {
        // Handle structured output parsing at the very end
        let finalOutput = fullContent;
        if (structuredOutput) {
          try {
            finalOutput = JSON.parse(fullContent);
          } catch (e) {
            return resolve(Services.v2Core.Helpers.Err('Error: Could not parse final stream to JSON.'));
          }
        }

        resolve(Services.v2Core.Helpers.Ok({
          searchResult: finalOutput,
          citations: finalCitations,
        }));
      });

      response.data.on('error', (err) => {
        reject(Services.v2Core.Helpers.Err(`Stream Error: ${err.message}`));
      });
    });

  } catch (error) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    return Services.v2Core.Helpers.Err(`Error (callPerplexity): ${errorMsg}`);
  }
}


// /**
//  * Unified Perplexity AI call handler (Synchronous only).
//  * * @param {string} systemMessage
//  * @param {string} contentMessage
//  * @param {object} options
//  * @param {string} options.model            - Required: The specific Perplexity model to use
//  * @param {object} [options.structuredOutput] - If provided, returns parsed JSON
//  * @param {string[]} [options.domains]      - Array of domains to include/exclude (max 20)
//  * @param {ModelTypes} [options.capability]    - What capability is required for the call (for routing)
//  */
// export async function callPerplexity(
//   systemMessage,
//   contentMessage,
//   model,
//   options = {}
// ) {
//   console.log(`Calling Perplexity : ${model}`);
  
//   const ppxAPI = process.env.PXY_KEY;

//   const { structuredOutput, domains = [] } = options;

//   // Validation: Ensure a model is provided
//   if (!model) {
//     return Services.v2Core.Helpers.Err(
//       'Error (callPerplexity): No model provided in options.'
//     );
//   }

//   const url = 'https://api.perplexity.ai/chat/completions';
//   const headers = {
//     Authorization: `Bearer ${ppxAPI}`,
//     'Content-Type': 'application/json',
//   };

//   // Domain filter safety (Perplexity API limit is 20)
//   const domainFilter = Array.isArray(domains) ? domains.slice(0, 20) : [];

//   const payload = {
//     model: model,
//     messages: [
//       { role: 'system', content: systemMessage },
//       { role: 'user', content: contentMessage },
//     ],
//     search_domain_filter: domainFilter,
//   };

//   // Inject structured output format if schema is present
//   if (structuredOutput) {
//     payload.response_format = {
//       type: 'json_schema',
//       json_schema: { schema: structuredOutput },
//     };
//   }

//   try {
//     const response = await axios.post(url, payload, { headers });
//     const data = response.data;
//     let content = data.choices[0].message.content;

//     // Parse JSON if we requested structured output
//     if (structuredOutput) {
//       try {
//         content = JSON.parse(content);
//       } catch (e) {
//         return Services.v2Core.Helpers.Err(
//           'Error (callPerplexity): Could not parse response to JSON.'
//         );
//       }
//     }

//     return Services.v2Core.Helpers.Ok({
//       searchResult: content,
//       citations: data.citations || [],
//     });
//   } catch (error) {
//     // Return detailed error if possible, otherwise generic message
//     const errorMsg =
//       error.response?.data?.error?.message || error.message || error;
//     return Services.v2Core.Helpers.Err(`Error (callPerplexity): ${errorMsg}`);
//   }
// }
