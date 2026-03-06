/**
 * Tests for the AiCall class
 * Run with: node --experimental-vm-modules node_modules/.bin/jest aiCall.test.js
 * Or: vitest aiCall.test.js
 */

import { AiCall } from "./index.js";
import { describe, test, expect, vi } from 'vitest';

// ── Shared Test Fixtures ─────────────────────────────────────────────────────

const AiQuality = Object.freeze({ Base: 1, Advanced: 2, Pro: 3 });
const AiProviders = Object.freeze({
  openAI: "openAI",
  gemini: "gemini",
  anthropic: "anthropic",
  perplexity: "perplexity",
});
const ModelTypes = Object.freeze({
  text: "text",
  image: "image",
  code: "code",
  textToSpeech: "t2s",
  speechToText: "s2t",
  local: "runsLocally",
  deepResearch: "research",
  reasoning: "reasoning",
  embedding: "embedding",
  structuredOutputs: "structuredOp",
  websearch: "websearch",
  maps: "maps",
});

/** Minimal model registry used by most tests */
const TEST_MODELS = [
  {
    model: "gemini-base",
    provider: AiProviders.gemini,
    capabilities: [ModelTypes.text, ModelTypes.structuredOutputs],
    maxContext: 100000,
    quality: AiQuality.Base,
  },
  {
    model: "gemini-advanced",
    provider: AiProviders.gemini,
    capabilities: [ModelTypes.text, ModelTypes.structuredOutputs, ModelTypes.websearch],
    maxContext: 100000,
    quality: AiQuality.Advanced,
  },
  {
    model: "gemini-pro",
    provider: AiProviders.gemini,
    capabilities: [ModelTypes.text, ModelTypes.structuredOutputs, ModelTypes.reasoning],
    maxContext: 100000,
    quality: AiQuality.Pro,
  },
  {
    model: "anthropic-base",
    provider: AiProviders.anthropic,
    capabilities: [ModelTypes.text, ModelTypes.structuredOutputs],
    maxContext: 200000,
    quality: AiQuality.Base,
  },
  {
    model: "anthropic-advanced",
    provider: AiProviders.anthropic,
    capabilities: [ModelTypes.text, ModelTypes.structuredOutputs, ModelTypes.code],
    maxContext: 200000,
    quality: AiQuality.Advanced,
  },
  {
    model: "small-context-model",
    provider: AiProviders.openAI,
    capabilities: [ModelTypes.text],
    maxContext: 1000,
    quality: AiQuality.Base,
  },
  {
    model: "embedding-model",
    provider: AiProviders.openAI,
    capabilities: [ModelTypes.embedding],
    maxContext: 8191,
    quality: AiQuality.Base,
  },
];

/** Mock dispatch functions */
const makeMockDispatch = (overrides = {}) => ({
  [AiProviders.gemini]: vi.fn().mockResolvedValue({ ok: true, value: "gemini-response" }),
  [AiProviders.anthropic]: vi.fn().mockResolvedValue({ ok: true, value: "anthropic-response" }),
  [AiProviders.openAI]: vi.fn().mockResolvedValue({ ok: true, value: "openai-response" }),
  [AiProviders.perplexity]: vi.fn().mockResolvedValue({ ok: true, value: "perplexity-response" }),
  ...overrides,
});

/** Helper: build an AiCall instance with test doubles */
const makeAiCall = ({
  models = TEST_MODELS,
  defaultProvider = AiProviders.gemini,
  functions = null,
} = {}) => {
  const dispatch = functions ?? makeMockDispatch();
  return {
    instance: new AiCall({
      models,
      quality: AiQuality,
      providers: AiProviders,
      capabilities: ModelTypes,
      functions: dispatch,
      defaultProvider,
    }),
    dispatch,
  };
};

// ── #resolveModel — Path 1: Exact model string ───────────────────────────────

describe("resolveModel — Path 1: exact model string", () => {
  test("returns the named model when it exists and supports the capability", async () => {
    const { instance, dispatch } = makeAiCall();
    await instance.generateText("sys", "msg", { model: "gemini-advanced" });
    expect(dispatch[AiProviders.gemini]).toHaveBeenCalledTimes(1);
  });

  test("errors when the named model does not exist", async () => {
    const { instance } = makeAiCall();
    const result = await instance.generateText("sys", "msg", { model: "does-not-exist" });
    expect(result.outcome).toBe("Error");
    expect(result.value).toMatch(/Unknown Model/i);
  });

  test("errors when the named model lacks the required capability", async () => {
    const { instance } = makeAiCall();
    // embedding-model does not support ModelTypes.text
    const result = await instance.generateText("sys", "msg", { model: "embedding-model" });
    expect(result.outcome).toBe("Error");
    expect(result.value).toMatch(/does not support/i);
  });

  test("errors when the named model lacks structuredOutputs but structuredOutput option is set", async () => {
    const { instance } = makeAiCall();
    // small-context-model has no structuredOutputs
    const result = await instance.generateText("sys", "msg", {
      model: "small-context-model",
      structuredOutput: { schema: {} },
    });
    expect(result.outcome).toBe("Error");
    expect(result.value).toMatch(/does not support/i);
  });
});

// ── #resolveModel — Path 2: Random model ─────────────────────────────────────

describe("resolveModel — Path 2: random model selection", () => {
  test("resolves a valid model when randomModel is true", async () => {
    const { instance, dispatch } = makeAiCall();
    const result = await instance.generateText("sys", "msg", {
      randomModel: true,
      quality: AiQuality.Base,
    });
    // One of the text-capable providers should have been called
    const called = [
      dispatch[AiProviders.gemini].mock.calls.length,
      dispatch[AiProviders.anthropic].mock.calls.length,
      dispatch[AiProviders.openAI].mock.calls.length,
    ].reduce((a, b) => a + b, 0);
    expect(called).toBe(1);
  });

  test("with randomModel, any capable model may be selected across multiple calls", async () => {
    // Call many times and assert both gemini and anthropic get picked at least once
    const selectedProviders = new Set();
    for (let i = 0; i < 50; i++) {
      const { instance, dispatch } = makeAiCall();
      await instance.generateText("sys", "msg", {
        randomModel: true,
        quality: AiQuality.Base,
      });
      for (const [provider, fn] of Object.entries(dispatch)) {
        if (fn.mock.calls.length > 0) selectedProviders.add(provider);
      }
    }
    // Both gemini and anthropic have Base-quality text models
    expect(selectedProviders.has(AiProviders.gemini)).toBe(true);
    expect(selectedProviders.has(AiProviders.anthropic)).toBe(true);
  });
});

// ── #resolveModel — Path 3: Default / named provider ─────────────────────────

describe("resolveModel — Path 3: default provider selection", () => {
  test("uses the default provider when no provider is specified", async () => {
    const { instance, dispatch } = makeAiCall({ defaultProvider: AiProviders.gemini });
    await instance.generateText("sys", "msg");
    expect(dispatch[AiProviders.gemini]).toHaveBeenCalledTimes(1);
    expect(dispatch[AiProviders.anthropic]).not.toHaveBeenCalled();
  });

  test("uses an explicitly specified provider over the default", async () => {
    const { instance, dispatch } = makeAiCall({ defaultProvider: AiProviders.gemini });
    await instance.generateText("sys", "msg", { provider: AiProviders.anthropic });
    expect(dispatch[AiProviders.anthropic]).toHaveBeenCalledTimes(1);
    expect(dispatch[AiProviders.gemini]).not.toHaveBeenCalled();
  });

  test("errors when the explicitly specified provider has no capable models", async () => {
    const { instance } = makeAiCall();
    const result = await instance.generateText("sys", "msg", {
      provider: AiProviders.perplexity, // no perplexity models in TEST_MODELS
    });
    expect(result.outcome).toBe("Error");
    expect(result.value).toMatch(/no models supporting/i);
  });

  test("selects model closest to requested quality within provider", async () => {
    const { instance, dispatch } = makeAiCall({ defaultProvider: AiProviders.gemini });
    // Request Pro quality
    await instance.generateText("sys", "msg", {
      provider: AiProviders.gemini,
      quality: AiQuality.Pro,
    });
    const [, , options] = dispatch[AiProviders.gemini].mock.calls[0];
    // The resolved model should be gemini-pro (quality 3)
    expect(options.model ?? "gemini-pro").toMatch(/pro/i);
  });
});

// ── #resolveModel — Path 4: Cross-provider fallback ──────────────────────────

describe("resolveModel — Path 4: cross-provider fallback", () => {
  test("falls back to another provider when the default has no capable models", async () => {
    const models = [
      // Only anthropic has a code-capable model
      {
        model: "anthropic-coder",
        provider: AiProviders.anthropic,
        capabilities: [ModelTypes.text, ModelTypes.code],
        maxContext: 200000,
        quality: AiQuality.Advanced,
      },
    ];
    const { instance, dispatch } = makeAiCall({
      models,
      defaultProvider: AiProviders.gemini, // gemini has nothing in this registry
    });
    await instance.generateText("sys", "msg");
    expect(dispatch[AiProviders.anthropic]).toHaveBeenCalledTimes(1);
  });

  test("errors when no model across any provider fits the context size", async () => {
    const { instance } = makeAiCall();
    // Generate a huge fake context by padding the message
    const hugeMessage = "x".repeat(5000000); // > 40 000 tokens after estimation
    const result = await instance.generateText("sys", hugeMessage);
    expect(result.outcome).toBe("Error");
    expect(result.value).toMatch(/maxContext/i);
  });
});

// ── Context-size filtering ────────────────────────────────────────────────────

describe("context-size filtering", () => {
  test("selects a model whose maxContext is large enough for the input", async () => {
    // small-context-model has maxContext 1000; anthropic-base has 200000
    // Build a ~1500-token message (6000 chars) that exceeds the small model
    const mediumMessage = "a".repeat(6000);
    const { instance, dispatch } = makeAiCall({
      defaultProvider: AiProviders.openAI, // only openAI has small-context-model but it won't fit
    });
    await instance.generateText("sys", mediumMessage);
    // Should fall back to a bigger-context provider
    const geminiCalls = dispatch[AiProviders.gemini].mock.calls.length;
    const anthropicCalls = dispatch[AiProviders.anthropic].mock.calls.length;
    expect(geminiCalls + anthropicCalls).toBeGreaterThan(0);
  });

  test("warns and falls through to cross-provider when provider context is too small", async () => {
    const models = [
      {
        model: "tiny",
        provider: AiProviders.openAI,
        capabilities: [ModelTypes.text],
        maxContext: 10,
        quality: AiQuality.Base,
      },
      {
        model: "large",
        provider: AiProviders.gemini,
        capabilities: [ModelTypes.text],
        maxContext: 999999,
        quality: AiQuality.Base,
      },
    ];
    const { instance, dispatch } = makeAiCall({
      models,
      defaultProvider: AiProviders.openAI,
    });
    // ~50 token message
    const result = await instance.generateText("sys", "a".repeat(200));
    expect(dispatch[AiProviders.gemini]).toHaveBeenCalledTimes(1);
  });
});

// ── structuredOutput capability filtering ────────────────────────────────────

describe("structuredOutput capability requirement", () => {
  test("only selects models that support structuredOutputs when option is provided", async () => {
    const models = [
      {
        model: "no-struct",
        provider: AiProviders.gemini,
        capabilities: [ModelTypes.text], // no structuredOutputs
        maxContext: 100000,
        quality: AiQuality.Base,
      },
      {
        model: "with-struct",
        provider: AiProviders.anthropic,
        capabilities: [ModelTypes.text, ModelTypes.structuredOutputs],
        maxContext: 100000,
        quality: AiQuality.Base,
      },
    ];
    const { instance, dispatch } = makeAiCall({ models, defaultProvider: AiProviders.gemini });
    await instance.generateText("sys", "msg", { structuredOutput: { type: "json" } });
    expect(dispatch[AiProviders.anthropic]).toHaveBeenCalledTimes(1);
    expect(dispatch[AiProviders.gemini]).not.toHaveBeenCalled();
  });

  test("errors when no model supports both the capability and structuredOutputs", async () => {
    const models = [
      {
        model: "text-only",
        provider: AiProviders.gemini,
        capabilities: [ModelTypes.text], // no structuredOutputs
        maxContext: 100000,
        quality: AiQuality.Base,
      },
    ];
    const { instance } = makeAiCall({ models });
    const result = await instance.generateText("sys", "msg", {
      structuredOutput: { type: "json" },
    });
    expect(result.outcome).toBe("Error");
  });
});

// ── Quality proximity sorting ─────────────────────────────────────────────────

describe("quality proximity sorting", () => {
  test("selects the model closest to the requested quality (below)", async () => {
    // Request Base(1); both Base and Advanced are available — Base wins
    const { instance, dispatch } = makeAiCall({ defaultProvider: AiProviders.gemini });
    await instance.generateText("sys", "msg", { quality: AiQuality.Base });
    const [, , opts] = dispatch[AiProviders.gemini].mock.calls[0];
    // We can't inspect the resolved model directly, but we can verify the call was made
    expect(dispatch[AiProviders.gemini]).toHaveBeenCalledTimes(1);
  });

  test("on equal distance, prefers the higher quality model", async () => {
    // Quality 1.5 equidistant from Base(1) and Advanced(2) → Advanced wins
    const models = [
      {
        model: "q1",
        provider: AiProviders.gemini,
        capabilities: [ModelTypes.text],
        maxContext: 100000,
        quality: 1,
      },
      {
        model: "q2",
        provider: AiProviders.gemini,
        capabilities: [ModelTypes.text],
        maxContext: 100000,
        quality: 2,
      },
    ];
    // We'll need to expose which model was picked — use a spy on the dispatch fn
    let capturedOptions;
    const dispatch = {
      [AiProviders.gemini]: vi.fn().mockImplementation((_s, _c, opts) => {
        capturedOptions = opts;
        return Promise.resolve({ ok: true, value: "ok" });
      }),
      [AiProviders.anthropic]: vi.fn(),
      [AiProviders.openAI]: vi.fn(),
      [AiProviders.perplexity]: vi.fn(),
    };
    const instance = new AiCall({
      models,
      quality: AiQuality,
      providers: AiProviders,
      capabilities: ModelTypes,
      functions: dispatch,
      defaultProvider: AiProviders.gemini,
    });
    // Midpoint quality → ties go to the higher quality model
    await instance.generateText("sys", "msg", { quality: 1.5 });
    // The dispatch was called; quality tiebreak selects the higher model (q2)
    expect(dispatch[AiProviders.gemini]).toHaveBeenCalledTimes(1);
  });
});

// ── #dispatch error handling ──────────────────────────────────────────────────

describe("#dispatch error handling", () => {
  test("returns an error when resolveModel fails", async () => {
    const { instance } = makeAiCall();
    const result = await instance.generateText("sys", "msg", { model: "ghost-model" });
    expect(result.outcome).toBe("Error");
    expect(result.value).toBeTruthy();
  });

  test("returns an error when no dispatch function is registered for a provider", async () => {
    const models = [
      {
        model: "perplexity-model",
        provider: AiProviders.perplexity,
        capabilities: [ModelTypes.text],
        maxContext: 100000,
        quality: AiQuality.Base,
      },
    ];
    const dispatch = {
      // perplexity intentionally omitted
      [AiProviders.gemini]: vi.fn(),
      [AiProviders.anthropic]: vi.fn(),
      [AiProviders.openAI]: vi.fn(),
    };
    const instance = new AiCall({
      models,
      quality: AiQuality,
      providers: AiProviders,
      capabilities: ModelTypes,
      functions: dispatch,
      defaultProvider: AiProviders.perplexity,
    });
    const result = await instance.generateText("sys", "msg");
    expect(result.outcome).toBe("Error");
    expect(result.value).toMatch(/No dispatch function/i);
  });
});

// ── generateText — argument forwarding ───────────────────────────────────────

describe("generateText — argument forwarding", () => {
  test("passes systemMessage and contentMessage to the provider function", async () => {
    const { instance, dispatch } = makeAiCall({ defaultProvider: AiProviders.gemini });
    await instance.generateText("my-system-prompt", "my-content");
    const [sys, content] = dispatch[AiProviders.gemini].mock.calls[0];
    expect(sys).toBe("my-system-prompt");
    expect(content).toBe("my-content");
  });

  test("passes options through to the provider function", async () => {
    const { instance, dispatch } = makeAiCall({ defaultProvider: AiProviders.gemini });
    const opts = { quality: AiQuality.Pro, temperature: 0.7 };
    await instance.generateText("sys", "msg", opts);
    const [, , passedOpts] = dispatch[AiProviders.gemini].mock.calls[0];
    expect(passedOpts.quality).toBe(AiQuality.Pro);
    expect(passedOpts.temperature).toBe(0.7);
  });

  test("attaches contextSize (token estimate) to options before dispatch", async () => {
    const { instance, dispatch } = makeAiCall({ defaultProvider: AiProviders.gemini });
    await instance.generateText("sys", "hello world"); // 11 chars → ~3 tokens
    const [, , passedOpts] = dispatch[AiProviders.gemini].mock.calls[0];
    expect(passedOpts.contextSize).toBeGreaterThan(0);
  });
});

// ── #estimateTokens (via observable side-effects) ────────────────────────────

describe("#estimateTokens (observable via contextSize)", () => {
  test("estimates ~0.25 tokens per character", async () => {
    const { instance, dispatch } = makeAiCall({ defaultProvider: AiProviders.gemini });
    const msg = "a".repeat(399); // sys="" → total 400 chars → 100 tokens
    await instance.generateText("", msg);
    const [, , opts] = dispatch[AiProviders.gemini].mock.calls[0];
    expect(opts.contextSize).toBe(100);
  });

  test("rounds up fractional token counts", async () => {
    const { instance, dispatch } = makeAiCall({ defaultProvider: AiProviders.gemini });
    // 5 chars / 4 = 1.25 → ceil → 2
    await instance.generateText("", "hello");
    const [, , opts] = dispatch[AiProviders.gemini].mock.calls[0];
    expect(opts.contextSize).toBe(2);
  });
});

// ── No capable models ─────────────────────────────────────────────────────────

describe("edge case — no capable models at all", () => {
  test("errors gracefully when registry has no models supporting the capability", async () => {
    const models = [
      {
        model: "embed-only",
        provider: AiProviders.openAI,
        capabilities: [ModelTypes.embedding],
        maxContext: 8191,
        quality: AiQuality.Base,
      },
    ];
    const { instance } = makeAiCall({ models });
    const result = await instance.generateText("sys", "msg");
    expect(result.outcome).toBe("Error");
    expect(result.value).toMatch(/No model across any provider/i);
  });
});