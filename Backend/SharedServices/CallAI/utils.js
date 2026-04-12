import { AiQuality, MODEL_REGISTRY} from '../constants.js';

/**
 * Groups models by provider, sorts them by quality, 
 * and converts quality values to display strings.
 * @Returns {object} - An object with providers as keys and arrays of model objects as values
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