import { callOpenAI } from './CallAI/openAI.js';
import { callGemini } from './CallAI/gemini.js';
import { callAnthropic } from './CallAI/anthropic.js';
import { callPerplexity } from './CallAI/perplexity.js';

// INDEX ---------------
// 1. Call Ai Constants
// 2. Database Constants
// 3. FileSystem Constants

// 1. CALL AI CONSTANTS
export const AiProviders = Object.freeze({
  openAI: 'openAI',
  gemini: 'gemini',
  anthropic: 'anthropic',
  perplexity: 'perplexity',
});
export const DEFAULT_PROVIDER = AiProviders.gemini; // <- Default AI provider
export const AiQuality = Object.freeze({
  Base: 1,
  Advanced: 2,
  Pro: 3,
});
export const ModelTypes = Object.freeze({
  text: 'text',
  image: 'image',
  code: 'code',
  textToSpeech: 't2s',
  speechToText: 's2t',
  local: 'runsLocally',
  deepResearch: 'research',
  reasoning: 'reasoning',
  embedding: 'embedding',
  structuredOutputs: 'structuredOp',
  websearch: 'websearch',
  maps: 'maps',
});
export const PROVIDER_DISPATCH = {
  [AiProviders.openAI]: callOpenAI,
  [AiProviders.gemini]: callGemini,
  [AiProviders.anthropic]: callAnthropic,
  [AiProviders.perplexity]: callPerplexity,
};
export const MODEL_REGISTRY = [
  {
    model: 'gpt-5-nano',
    provider: AiProviders.openAI,
    capabilities: [
      ModelTypes.text,
      ModelTypes.structuredOutputs,
      ModelTypes.websearch,
    ],
    maxContext: 400000,
    quality: AiQuality.Base,
  },
  {
    model: 'text-embedding-3-small',
    provider: AiProviders.openAI,
    capabilities: [ModelTypes.embedding],
    maxContext: 8191,
    quality: AiQuality.Base,
  },
  {
    model: 'gemini-2.0-flash',
    provider: AiProviders.gemini,
    capabilities: [
      ModelTypes.text,
      ModelTypes.structuredOutputs,
      ModelTypes.websearch,
      ModelTypes.maps,
    ],
    maxContext: 1048576,
    quality: AiQuality.Base,
  },
  {
    model: 'gemini-2.5-flash',
    provider: AiProviders.gemini,
    capabilities: [
      ModelTypes.text,
      ModelTypes.structuredOutputs,
      ModelTypes.websearch,
      ModelTypes.maps,
    ],
    maxContext: 1048576,
    quality: AiQuality.Advanced,
  },
  {
    model: 'gemini-2.5-pro',
    provider: AiProviders.gemini,
    capabilities: [
      ModelTypes.text,
      ModelTypes.structuredOutputs,
      ModelTypes.websearch,
      ModelTypes.maps,
      ModelTypes.reasoning,
    ],
    maxContext: 1048576,
    quality: AiQuality.Pro,
  },
  {
    model: 'claude-haiku-4-5-20251001',
    provider: AiProviders.anthropic,
    capabilities: [ModelTypes.text, ModelTypes.structuredOutputs],
    maxContext: 200000,
    quality: AiQuality.Base,
  },
  {
    model: 'claude-sonnet-4-6',
    provider: AiProviders.anthropic,
    capabilities: [
      ModelTypes.text,
      ModelTypes.structuredOutputs,
      ModelTypes.code,
    ],
    maxContext: 200000,
    quality: AiQuality.Advanced,
  },
  {
    model: 'claude-opus-4-6',
    provider: AiProviders.anthropic,
    capabilities: [
      ModelTypes.text,
      ModelTypes.structuredOutputs,
      ModelTypes.code,
      ModelTypes.reasoning,
    ],
    maxContext: 200000,
    quality: AiQuality.Pro,
  },
  {
    model: 'sonar',
    provider: AiProviders.perplexity,
    capabilities: [
      ModelTypes.text,
      ModelTypes.deepResearch,
      ModelTypes.websearch,
    ],
    maxContext: 127072,
    quality: AiQuality.Advanced,
  },
  // {
  //     model:        "sonar-reasoning-pro",
  //     provider:     AiProviders.perplexity,
  //     capabilities: [ModelTypes.text, ModelTypes.deepResearch, ModelTypes.websearch, ModelTypes.reasoning],
  //     maxContext:   127072,
  //     quality:      AiQuality.Pro,
  // },
];

// 2. Database Constants

// Folder Names/ Locations
// Note - if updating, check values in docker-compose.yml and .env match
export const appFilesDir = 'AppFiles';
export const userFilesDir = 'UserFiles';

// Database
export const namespaceName = 'FolderBot';
export const databaseName = 'KnowledgeBaseIndex';
export const dirTableName = 'Directories';
export const fileTableName = 'Files';
export const mgmtTableName = 'mgmtData';
export const vectorTableName = 'FileVectors';
export const toolTableName = 'ToolVectors';
export const vectorEmbedSize = 1024;

// "http://indexdb:8000/rpc"; (live-inter-container) | "http://127.0.0.1:8000/rpc" (testing from CLI)
export const dbURL = 'http://indexdb:8000/rpc';
export const dbURL_Fallback = 'http://127.0.0.1:8000/rpc';

// 3. FileSystem Constants
export const containerVolumeRoot = '/data'; // set in docker-compose.yml *don't change this!
