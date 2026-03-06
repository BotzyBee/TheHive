import { SharedUtils } from '../Utils/index.js';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { makeSchemaStrict } from './index.js';

// Uses Google API not Langchain interface
// https://ai.google.dev/gemini-api/docs#javascript

let su = new SharedUtils();

/**
 * Unified Gemini AI call handler.
 * @param {string} systemMessage - System instructions
 * @param {string} contentMessage - User prompt/content
 * @param {object} options
 * @param {object} [options.structuredOutput] - If provided, returns parsed JSON via schema
 * @param {boolean} [options.useWeb]        - Enables Google Search grounding
 * @param {boolean} [options.capability]    - What capability is required for the call (for routing)
 */
export async function callGemini(
  systemMessage,
  contentMessage,
  model,
  options = {}
) {
  su.log(`Calling Gemini : ${model}`);
  dotenv.config({ path: '.env' });
  const gemiKey = process.env.GEM_KEY;

  const { structuredOutput, useWeb = false } = options;
  const schemaWithStrictness = makeSchemaStrict(structuredOutput); // enforce strictness;
  // Validation: Ensure a model is provided
  if (!model) {
    return su.logAndErr('Error (callGemini): No model provided in options.');
  }
  const ai = new GoogleGenAI({ apiKey: gemiKey });

  try {
    // Case 1: Structured Output WITH Web Search (Requires 2-step process)
    if (structuredOutput && useWeb) {
      // First call: Get grounded information
      const firstResponse = await ai.models.generateContent({
        model: model,
        contents: [contentMessage],
        config: {
          tools: [{ googleSearch: {} }],
          systemInstruction: systemMessage,
        },
      });

      // Second call: Format grounded info into JSON schema
      const secondResponse = await ai.models.generateContent({
        model: model,
        contents: [firstResponse.text],
        config: {
          responseMimeType: 'application/json',
          responseSchema: schemaWithStrictness,
          systemInstruction:
            'Analyse the input text and convert it to the output schema. Do not add new thoughts or new research.',
        },
      });

      return su.result_ok(JSON.parse(secondResponse.text));
    }

    // Case 2 & 3: Standard Chat or Structured Output (Single step)
    const config = {
      systemInstruction: systemMessage,
    };

    // Add Web Search tool if requested (and not handled by Case 1)
    if (useWeb) {
      config.tools = [{ googleSearch: {} }];
    }

    // Add JSON schema if requested
    if (structuredOutput) {
      config.responseMimeType = 'application/json';
      config.responseSchema = schemaWithStrictness;
    }

    const response = await ai.models.generateContent({
      model: model,
      contents: [contentMessage],
      config: config,
    });

    const finalResult = structuredOutput
      ? JSON.parse(response.text)
      : response.text;

    return su.result_ok(finalResult);
  } catch (error) {
    return su.logAndErr(`Error (callGemini): ${error}`);
  }
}
