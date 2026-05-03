import { callOpenAI } from '../services/openAI.js';
import { callGemini } from '../services/gemini.js';
import { callAnthropic } from '../services/anthropic.js';
import { callPerplexity } from '../services/perplexity.js';
import { callInception } from '../services/inception.js';
import { callKimi } from '../services/kimiProvider.js';
import { callOllama } from '../services/callOllama.js';
import { callDeepseek } from '../services/deepseek.js';
import { AiProviders } from '../core/constants.js';

export const PROVIDER_DISPATCH = {
  [AiProviders.openAI]: callOpenAI,
  [AiProviders.gemini]: callGemini,
  [AiProviders.anthropic]: callAnthropic,
  [AiProviders.perplexity]: callPerplexity,
  [AiProviders.inception]: callInception,
  [AiProviders.kimi]: callKimi,
  [AiProviders.ollama]: callOllama,
  [AiProviders.deepseek]: callDeepseek,
};
