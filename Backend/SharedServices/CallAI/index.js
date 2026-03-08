import * as su from '../Utils/index.js';
import {
  ModelTypes,
  AiQuality,
  AiProviders,
  MODEL_REGISTRY,
  PROVIDER_DISPATCH,
  DEFAULT_PROVIDER,
} from '../constants.js';

export class AiCall {
  #models = [];
  #AiQuality = {};
  #AiProviders = {};
  #ModelTypes = {};
  #ProviderFunctions = {};
  #defaultProvider = '';
  constructor({
    // Input only needed for testing!
    models = MODEL_REGISTRY,
    quality = AiQuality,
    providers = AiProviders,
    capabilities = ModelTypes,
    functions = PROVIDER_DISPATCH,
    defaultProvider = DEFAULT_PROVIDER,
  } = {}) {
    this.#models = models;
    this.#AiQuality = quality;
    this.#AiProviders = providers;
    this.#ModelTypes = capabilities;
    this.#ProviderFunctions = functions;
    this.#defaultProvider = defaultProvider;
  }

  /** Generate Text (model only - no tools)
   * @param {string} systemMessage
   * @param {string} contentMessage
   * @param {object} [options]
   * @param {string} [options.model]           - Exact model string (optional)
   * @param {string} [options.provider]        - AiProviders value (optional)
   * @param {number} [options.quality]         - AiQuality value (optional)
   * @param {object} [options.structuredOutput]  - If set, returns parsed JSON; (auto-filters structuredOutputs)
   * @param {bool}   [options.randomModel]       - If true a random model fitting the requirements will be chosen.
   */
  async generateText(systemMessage, contentMessage, options = {}) {
    const tkns = this.#estimateTokens(`${systemMessage} ${contentMessage}`);
    options.contextSize = tkns;
    return this.#dispatch(
      ModelTypes.text,
      systemMessage,
      contentMessage,
      options
    );
  }

  /** Generate Text using web search grounding
   * @param {string} systemMessage
   * @param {string} contentMessage
   * @param {object} [options]
   * @param {string} [options.model]           - Exact model string (optional)
   * @param {string} [options.provider]        - AiProviders value (optional)
   * @param {number} [options.quality]         - AiQuality value (optional)
   * @param {object} [options.structuredOutput]  - If set, returns parsed JSON; (auto-filters structuredOutputs)
   * @param {bool}   [options.randomModel]       - If true a random model fitting the requirements will be chosen.
   * @param {string[]} [options.domains]      - Array of domains to include/exclude (only perplexity at this time)
   */
  async webSearch(systemMessage, contentMessage, options = {}) {
    const tkns = this.#estimateTokens(`${systemMessage} ${contentMessage}`);
    options.contextSize = tkns;
    options.useWeb = true;
    return this.#dispatch(
      ModelTypes.websearch,
      systemMessage,
      contentMessage,
      options
    );
  }

  /** Generate Embeddings using embed model
   *
   * @param {object} [options]
   * @param {string} [options.model]           - Exact model string (optional)
   * @param {string} [options.provider]        - AiProviders value (optional)
   * @param {string[]} [options.inputDataVec]   - Input data [string, string, ...]
   * @param {number} [options.dimensionSize]    - Embeddings dimension size
   */
  async generateEmbeddings(options = {}) {
    options.contextSize = 0;
    options.embeddingsMode = true;
    return this.#dispatch(ModelTypes.embedding, '', '', options);
  }

  // async generateImage(systemMessage, contentMessage, options = {}) {
  //     const tkns = this.#estimateTokens(`${systemMessage} ${contentMessage}`);
  //     options.contextSize = tkns;
  //     return this.#dispatch(ModelTypes.image, systemMessage, contentMessage, options);
  // }

  // async generateCode(systemMessage, contentMessage, options = {}) {
  //     const tkns = this.#estimateTokens(`${systemMessage} ${contentMessage}`);
  //     options.contextSize = tkns;
  //     return this.#dispatch(ModelTypes.code, systemMessage, contentMessage, options);
  // }

  // async mapSearch(systemMessage, contentMessage, options = {}) {
  //     const tkns = this.#estimateTokens(`${systemMessage} ${contentMessage}`);
  //     options.contextSize = tkns;
  //     return this.#dispatch(ModelTypes.maps, systemMessage, contentMessage, options);
  // }

  // async textToSpeech(systemMessage, contentMessage, options = {}) {
  //     const tkns = this.#estimateTokens(`${systemMessage} ${contentMessage}`);
  //     options.contextSize = tkns;
  //     return this.#dispatch(ModelTypes.textToSpeech, systemMessage, contentMessage, options);
  // }

  // async speechToText(systemMessage, contentMessage, options = {}) {
  //     const tkns = this.#estimateTokens(`${systemMessage} ${contentMessage}`);
  //     options.contextSize = tkns;
  //     return this.#dispatch(ModelTypes.speechToText, systemMessage, contentMessage, options);
  // }

  // ── Private Functions ───────────────────────────────────────────
  /**
   * Resolves the best model entry from MODEL_REGISTRY for a given request.
   * @param {ModelTypes}  requiredCapability  - The capability the calling method needs
   * @param {object}      options
   * @param {string}      [options.model]       - Exact model string to use
   * @param {string}      [options.provider]    - Preferred provider; falls back to DEFAULT_PROVIDER
   * @param {number}      [options.quality]     - Desired quality level (AiQuality enum)
   * @param {object} [options.structuredOutput]   - bool: If set, structuredOutputs capability is also required
   * @param {number}      [options.contextSize] - Combined system + user message token count for context fitting
   * @param {bool}      [options.randomModel] - If true, randomly chooses a suitable model (avoids sending all traffic to one provider!)
   * @returns {Result{ ok: bool, value: { model: string, provider: string, entry: object } | string } }
   */
  #resolveModel(requiredCapability, options = {}) {
    const {
      model,
      provider,
      quality,
      structuredOutput,
      contextSize,
      randomModel,
    } = options;

    // Build the full capability requirements for this call
    const requiredCaps = new Set([requiredCapability]);
    if (structuredOutput) requiredCaps.add(this.#ModelTypes.structuredOutputs);

    // Helper function - quality-proximity sorter: closest to target wins; ties go to the higher quality model
    const requestQuality = quality ?? 2;
    const byQualityProximity = (a, b) => {
      const aDiff = Math.abs(a.quality - requestQuality);
      const bDiff = Math.abs(b.quality - requestQuality);
      if (aDiff !== bDiff) return aDiff - bDiff;
      return b.quality - a.quality; // ties → prefer higher
    };

    // Path 1: Caller named an exact model
    if (model !== null && typeof model == 'string') {
      const entry = this.#models.find((m) => m.model === model);
      if (!entry) {
        return su.logAndErr(
          `Error ( resolveModel ) : Unknown Model : ${model}`
        );
      }
      const missing = [...requiredCaps].filter(
        (c) => !entry.capabilities.includes(c)
      );
      if (missing.length) {
        return su.logAndErr(
          `Error ( resolveModel ) : ${model} does not support ${missing.join(', ')}`
        );
      }
      return su.Ok(entry);
    }

    // Filter models for other paths (filter capabilities & context size)
    const capableCandidates = this.#models.filter((m) =>
      [...requiredCaps].every((cap) => m.capabilities.includes(cap))
    );
    // catch no models available for task
    if (capableCandidates.length === 0) {
      su.logAndErr(
        `Error ( resolveModel ) : No model found supporting capabilities: [${[...requiredCaps].join(', ')}].`
      );
    }
    // Find models with right sized max context
    const ctxRequired = contextSize ?? 0;
    const contextSizeAndQualityApproved = capableCandidates.filter(
      (m) => m.maxContext >= ctxRequired && m.quality == requestQuality
    );
    if (contextSizeAndQualityApproved.length === 0) {
      su.logAndErr(`Error ( resolveModel ) : No model found supporting capabilities, Context Size and Quality. 
            Capabilities : [${[...requiredCaps].join(', ')}]. Context Size: ${ctxRequired}. Quality ${requestQuality}`);
    }

    // Path 2: Random suitable model
    if (randomModel == true) {
      let randomNum = Math.floor(
        Math.random() * contextSizeAndQualityApproved.length
      );
      return su.Ok(contextSizeAndQualityApproved[randomNum]);
    }

    // Path 3: Go with default provider (unless user specifies one) and closest model to quality
    const resolvedProvider = provider ?? this.#defaultProvider;
    const providerCandidates = capableCandidates.filter(
      (m) => m.provider === resolvedProvider
    );
    if (providerCandidates.length > 0) {
      // Path 3a: If contextSize provided, narrow to models whose maxContext fits
      if (contextSize != null) {
        const contextFit = providerCandidates.filter(
          (m) => m.maxContext >= contextSize
        );
        if (contextFit.length > 0) {
          return su.Ok(contextFit.sort(byQualityProximity)[0]); // nearest to quality requested.
        }
        // No model from this provider fits the context — warn and fall through
        su.log(
          `WARN: ( AiCall -> resolveModel ) :  Provider "${resolvedProvider}" has no models with maxContext >= ${contextSize}.` +
            `Falling through to cross-provider selection.`
        );
      } else {
        // No context constraint — just pick by quality proximity within provider
        return su.Ok(providerCandidates.sort(byQualityProximity)[0]);
      }
    } else if (provider) {
      // Caller explicitly named a provider that has no capable models — hard fail
      su.log(
        `WARN: ( resolveModel ) : Provider "${provider}" has no models supporting: ` +
          `[${[...requiredCaps].join(', ')}]. Falling back to any suitable model available.`
      );
      // Fall back to any suitable model
      let newOptions = options;
      newOptions.provider = undefined;
      return this.#resolveModel(requiredCapability, newOptions);
    }
    // If default provider had no matches, silently fall through to Path 3
    // ── Path 4: No usable provider match — best capability + quality fit across all providers ──
    let fallbackCandidates = capableCandidates;
    if (contextSize != null) {
      const contextFit = fallbackCandidates.filter(
        (m) => m.maxContext == null || m.maxContext >= contextSize
      );
      if (contextFit.length > 0) {
        fallbackCandidates = contextFit;
      } else {
        return su.logAndErr(
          `Error ( resolveModel ) : No model across any provider has maxContext >= ${contextSize}. Unable to progress`
        );
      }
    }
    return su.Ok(fallbackCandidates.sort(byQualityProximity)[0]);
  }

  /**
   * Dispatch function routes to the required AI provider
   * @param {ModelTypes} capability 
   * @param {string} systemMessage 
   * @param {string} contentMessage 
   * @param {object} options 
   * @returns {Result( any | string )} - Result{ outcome: 'Ok' | 'Error', value: any | string }
   */
  async #dispatch(capability, systemMessage, contentMessage, options) {
    const entry = this.#resolveModel(capability, options);
    if (entry.isErr()) {
      return su.Err(`#dispatch -> ` + entry.value);
    }
    const callFn = this.#ProviderFunctions[entry.value.provider];
    if (!callFn) {
      return su.logAndErr(
        `Error : ( #dispatch ) No dispatch function registered for provider. ${entry.value.provider}`
      );
    }
    options.capability = capability;
    return callFn(systemMessage, contentMessage, entry.value.model, options); // doesn't need Ok() as underlying function has the return type.
  }

  #estimateTokens(inputString) {
    const length = inputString.length ?? 0;
    if (length === 0) return 0;
    const result = Math.ceil(length * 0.25); // roughly 4 chars to 1 token
    return result;
  }
}

/**
 * Recursively adds additionalProperties: false to all object nodes in a JSON schema.
 *  @param {object} schema - JSON Schema object for structured outputs
 */
export function makeSchemaStrict(schema) {
  if (typeof schema !== 'object' || schema === null) return schema;

  const newSchema = Array.isArray(schema) ? [...schema] : { ...schema };

  if (newSchema.type === 'object') {
    newSchema.additionalProperties = false;
  }

  // Recursively check properties, items (for arrays), etc.
  if (newSchema.properties) {
    for (const key in newSchema.properties) {
      newSchema.properties[key] = makeSchemaStrict(newSchema.properties[key]);
    }
  }

  if (newSchema.items) {
    newSchema.items = makeSchemaStrict(newSchema.items);
  }

  return newSchema;
}
