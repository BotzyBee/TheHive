export const AiProviders = Object.freeze({
  openAI: 'OpenAI',
  gemini: 'Gemini',
  anthropic: 'Anthropic',
  perplexity: 'Perplexity',
  inception: 'Inception'
});
export const DEFAULT_PROVIDER = AiProviders.gemini; // <---  ** Set Default AI provider **
export const AiQuality = Object.freeze({
  Base: 1,
  Advanced: 2,
  Pro: 3,
});
export const ModelTypes = Object.freeze({
  text: 'text',
  image: 'image',
  code: 'code',
  textToSpeech: 'Text to Speech',
  speechToText: 'Speech to Text',
  local: 'Runs Locally',
  deepResearch: 'Research',
  reasoning: 'Reasoning',
  embedding: 'Embedding',
  structuredOutputs: 'Structured Outputs',
  websearch: 'Web Search',
  maps: 'Maps',
});

export const MODEL_REGISTRY = [
  
  // [][] --- BASE MODELS --- [][]
  {
    model: 'gpt-5-nano',
    provider: AiProviders.openAI,
    capabilities: [
      ModelTypes.text,
      ModelTypes.structuredOutputs,
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
      ModelTypes.maps,
    ],
    maxContext: 1048576,
    quality: AiQuality.Base,
  },
  {
    model: 'gpt-5.1-codex-mini',
    provider: AiProviders.openAI,
    capabilities: [
      ModelTypes.code,
      ModelTypes.structuredOutputs,
    ],
    maxContext: 400000,
    quality: AiQuality.Base,
  },
  {
    model: 'claude-haiku-4-5-20251001',
    provider: AiProviders.anthropic,
    capabilities: [ModelTypes.text, ModelTypes.structuredOutputs],
    maxContext: 200000,
    quality: AiQuality.Base,
  },
  {
    model: 'sonar',
    provider: AiProviders.perplexity,
    capabilities: [
      ModelTypes.deepResearch,
      ModelTypes.websearch,
    ],
    maxContext: 127072,
    quality: AiQuality.Base,
  },

  // [][] --- ADVANCED MODELS --- [][]
  {
    model: 'sonar-pro',
    provider: AiProviders.perplexity,
    capabilities: [
      ModelTypes.deepResearch,
      ModelTypes.websearch,
    ],
    maxContext: 200000,
    quality: AiQuality.Advanced,
  },
  {
    model: 'gpt-5.4-mini',
    provider: AiProviders.openAI,
    capabilities: [
      ModelTypes.text,
      ModelTypes.structuredOutputs,
    ],
    maxContext: 400000,
    quality: AiQuality.Advanced,
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
    model: 'gemini-2.5-flash-image',
    provider: AiProviders.gemini,
    capabilities: [
      ModelTypes.image,
      ModelTypes.structuredOutputs
    ],
    maxContext: 65536,
    quality: AiQuality.Advanced,
  },
  {
    model: 'gemini-2.5-flash-preview-tts',
    provider: AiProviders.gemini,
    capabilities: [
      ModelTypes.textToSpeech
    ],
    maxContext: 32000,
    quality: AiQuality.Advanced,
  },
  {
    model: 'mercury-2',
    provider: AiProviders.inception,
    capabilities: [
      ModelTypes.text,
      ModelTypes.structuredOutputs,
    ],
    maxContext: 128000,
    quality: AiQuality.Advanced,
  },

  // [][] --- PRO MODELS --- [][]
  {
    model: 'gpt-5.4',
    provider: AiProviders.openAI,
    capabilities: [
      ModelTypes.text,
      ModelTypes.structuredOutputs,
    ],
    maxContext: 1050000,
    quality: AiQuality.Pro,
  },
  {
    model: 'gemini-3.1-pro-preview',
    provider: AiProviders.gemini,
    capabilities: [
      ModelTypes.text,
      ModelTypes.structuredOutputs,
      ModelTypes.websearch,
      ModelTypes.maps,
      ModelTypes.reasoning,
      ModelTypes.code
    ],
    maxContext: 1048576,
    quality: AiQuality.Pro,
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
    model: 'gpt-5.3-codex',
    provider: AiProviders.openAI,
    capabilities: [
      ModelTypes.code,
      ModelTypes.structuredOutputs,
    ],
    maxContext: 400000,
    quality: AiQuality.Pro,
  },
  {
    model: 'sonar-reasoning-pro',
    provider: AiProviders.perplexity,
    capabilities: [
      ModelTypes.deepResearch,
      ModelTypes.websearch,
    ],
    maxContext: 128000,
    quality: AiQuality.Pro,
  },

  // {
  //     model:        "sonar-reasoning-pro",
  //     provider:     AiProviders.perplexity,
  //     capabilities: [ModelTypes.text, ModelTypes.deepResearch, ModelTypes.websearch, ModelTypes.reasoning],
  //     maxContext:   127072,
  //     quality:      AiQuality.Pro,
  // },
];