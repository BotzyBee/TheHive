import { AiQuality, MODEL_REGISTRY } from "./constants";

/**
 * Recursively adds additionalProperties: false to all object nodes in a JSON schema,
 * only if additionalProperties is not already defined.
 * @param {object} schema - JSON Schema object for structured outputs
 */
export function makeSchemaStrict(schema) {
  if (typeof schema !== 'object' || schema === null) return schema;
  const newSchema = Array.isArray(schema) ? [...schema] : { ...schema };
  // Only set to false if the property is currently undefined
  if (newSchema.type === 'object' && newSchema.additionalProperties === undefined) {
    newSchema.additionalProperties = false;
  }
  // Recursively check properties
  if (newSchema.properties) {
    for (const key in newSchema.properties) {
      newSchema.properties[key] = makeSchemaStrict(newSchema.properties[key]);
    }
  }
  // Recursively check items (for arrays)
  if (newSchema.items) {
    newSchema.items = makeSchemaStrict(newSchema.items);
  }
  // Handle other keywords that might contain schemas, like anyOf, allOf, or oneOf
  ['anyOf', 'allOf', 'oneOf'].forEach(keyword => {
    if (Array.isArray(newSchema[keyword])) {
      newSchema[keyword] = newSchema[keyword].map(makeSchemaStrict);
    }
  });
  return newSchema;
}



/**
 * Groups models by provider, sorts them by quality, 
 * and converts quality values to display strings.
 * Returns {object} - An object with providers as keys and arrays of model objects as values
 * Output example:
    {
    openAI: [
        {
        model: 'gpt-5-nano',
        provider: 'OpenAI',
        capabilities: ['text', 'structuredOutputs', 'websearch'],
        maxContext: 400000,
        quality: 'Base',
        },
        // More models...
    ],
    gemini: [
        // Models...
    ],
    // Other providers...
    }
 */
export function getFormattedModelRegistry() {
    let models = MODEL_REGISTRY;
    // 1. Map for internal sorting logic
    const QUALITY_WEIGHTS = {
        [AiQuality.Pro]: 3,
        [AiQuality.Advanced]: 2,
        [AiQuality.Base]: 1,
    };

    // 2. Map for final string output
    const QUALITY_LABELS = {
        [AiQuality.Pro]: 'Pro',
        [AiQuality.Advanced]: 'Advanced',
        [AiQuality.Base]: 'Base',
    };

    // 3. Group the models by provider
    const grouped = models.reduce((acc, model) => {
        const providerKey = model.provider;
        if (!acc[providerKey]) {
        acc[providerKey] = [];
        }
        acc[providerKey].push({ ...model }); // Use a copy to avoid mutating the original registry
        return acc;
    }, {});

    // 4. Sort and transform the quality property
    for (const provider in grouped) {
        grouped[provider] = grouped[provider]
        .sort((a, b) => {
            const weightA = QUALITY_WEIGHTS[a.quality] || 0;
            const weightB = QUALITY_WEIGHTS[b.quality] || 0;
            return weightB - weightA; // Sort descending
        })
        .map((model) => ({
            ...model,
            quality: QUALITY_LABELS[model.quality] || 'Unknown', // Swap the value for the string
        }));
    }
    return grouped;
};