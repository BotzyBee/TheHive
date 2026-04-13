/**
 * 🐝 TheHive Plugin Tool Standard
 * Tool: textCombiner
 * Merges two or more text strings using a configurable separator.
 */

export const details = {
    toolName: "textCombiner",
    version: "1.0.0",
    creator: "HiveDev_AI",
    overview: "Combines two or more plain-text strings into a single output using a configurable separator (e.g. space, newline, comma). " +
              "This tool only performs text concatenation — it does not translate, summarise, reformat, or interpret the content of the strings.",
    guide: "",
    // IMPORTANT: inputSchema must be a stringified JSON object per the Plugin Standard
    inputSchema: JSON.stringify({
        type: "object",
        properties: {
            texts: {
                type: "array",
                description: "An ordered array of text strings to combine. Must contain at least two non-empty strings.",
                items: {
                    type: "string",
                    minLength: 1
                },
                minItems: 2
            },
            separator: {
                type: "string",
                description: "The string inserted between each piece of text. Defaults to a single space if omitted. " +
                             "Use '\\n' for a newline, ', ' for comma-separated, etc.",
                default: " "
            }
        },
        required: ["texts"],
        additionalProperties: false
    })
};

/**
 * Validates that every entry in the texts array is a non-empty string.
 * Keeping validation as a pure function makes it independently testable.
 *
 * @param {unknown[]} texts - Raw array from params
 * @returns {{ valid: boolean; reason?: string }}
 */
function validateTexts(texts) {
    if (!Array.isArray(texts)) {
        return { valid: false, reason: "'texts' must be an array." };
    }

    if (texts.length < 2) {
        return { valid: false, reason: "'texts' must contain at least two items." };
    }

    for (let index = 0; index < texts.length; index++) {
        const entry = texts[index];

        if (typeof entry !== "string") {
            return { valid: false, reason: `Item at index ${index} is not a string (received: ${typeof entry}).` };
        }

        // Guard against entries that are purely whitespace — likely an AI input mistake
        if (entry.trim().length === 0) {
            return { valid: false, reason: `Item at index ${index} is empty or whitespace-only.` };
        }
    }

    return { valid: true };
}

/**
 * Pure function that performs the actual combination.
 * Isolated from I/O concerns so it can be unit-tested without Shared dependencies.
 *
 * @param {string[]} texts     - Validated array of text strings
 * @param {string}   separator - The glue string between each text item
 * @returns {string} The combined text
 */
function combineTexts(texts, separator) {
    return texts.join(separator);
}

/**
 * @param {object} Shared              - Core Hive services (DataMessage, Roles, Ok, Err)
 * @param {object} params              - Inputs validated against inputSchema
 * @param {string[]} params.texts      - The text strings to combine
 * @param {string}  [params.separator] - Optional separator; defaults to a single space
 */
export async function run(Shared, params = {}) {
    const { texts, separator = " " } = params;

    // --- Input Validation ---
    const validation = validateTexts(texts);
    if (!validation.valid) {
        return Shared.Utils.Err(`[${details.toolName}] Invalid input — ${validation.reason}`);
    }

    // Coerce separator: if the AI passes a literal '\n' string, honour the escape
    const resolvedSeparator = typeof separator === "string"
        ? separator.replace(/\\n/g, "\n").replace(/\\t/g, "\t")
        : " ";

    try {
        const combinedText = combineTexts(texts, resolvedSeparator);

        const resultData = {
            combinedText,
            inputCount: texts.length,
            separatorUsed: resolvedSeparator,
            characterCount: combinedText.length,
            timestamp: new Date().toISOString()
        };

        const message = new Shared.Classes.DataMessage({
            role: Shared.Classes.Roles.Tool,
            data: resultData,
            toolName: details.toolName,
            instructions: "Combined the provided text strings using the specified separator. "
        });

        return Shared.Utils.Ok([message]);

    } catch (error) {
        // Defensive catch — combineTexts is synchronous and unlikely to throw,
        // but we guard here to satisfy the standard's error-handling contract.
        return Shared.Utils.Err(`[${details.toolName}] Unexpected error: ${error.message}`);
    }
}
