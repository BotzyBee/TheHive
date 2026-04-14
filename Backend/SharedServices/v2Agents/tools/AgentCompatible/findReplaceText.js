/*
    Uses The Hive Plugin Tool Standard
*/

export const details = {
    toolName:   "findAndReplaceTextTool",
    version:    "2026.0.1",
    creator:    "Botzy Bee",
    overview:   "A tool for finding and replacing letters, words or phrases within a text string. "+ 
        "Includes options for case-sensitive and whole word matching. \n"+
        "This tool can only do direct replacements, it cannot modify, create or change text in any other way.", 
    guide:      null,  
    inputSchema: {
        "type": "object",
        "properties": {
            "context": {
            "type": "string",
            "description": "The context text which will be modified by the tool."
            },
            "matchPhrase": {
            "type": "string",
            "description": "The string phrase used for matching."
            },
            "replaceWith": {
            "type": "string",
            "description": "The string which will replace the matchPhrase."
            },
            "caseSensitive": {
            "type": "boolean",
            "description": "If true, the matching will be case sensitive.",
            "default": false
            },
            "exactMatch": {
            "type": "boolean",
            "description": "If true, only exact matches will be changed.",
            "default": true
            }
        },
        "required": [
            "context",
            "matchPhrase",
            "replaceWith"
        ],
        "additionalProperties": false
        }
    };

/**
 * A tool for performing find and replace action on a given text.
 * @param {Services} Shared - For passing the SharedServices object exported via 'Services' 
 * @param {object}  options
 * @param {string}  options.context - The context text which will be modified by the tool. 
 * @param {string}  options.matchPhrase - The string phrase used for matching. 
 * @param {string}  options.replaceWith - The string which will replace the matchPhrase
 * @param {boolean} options.caseSensitive - If true the matching will be case sensitive (Optional)
 * @param {boolean} options.exactMatch - If true only exact matches will be changed (Optional)
 * @returns {Result[ [TextMessage ] | string ] } - Returns a result or string depending if Ok or Err.
 */
export async function run( 
    Shared, 
    params = {}
){  
    // Destructure input
    const {
        context,
        matchPhrase,
        replaceWith,
        caseSensitive = false,
        exactMatch = true
    } = params;
    
    // Catch objects passed as context
    if(typeof context === 'object'){ return Shared.v2Core.Helpers.Err(`Error (findAndReplaceTextTool) : Object passed as context - this should only be a string!`) }

    try {
        // Escape special regex characters in the match phrase
        const escapedMatch = matchPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Build regex pattern
        const pattern = exactMatch
            ? `\\b${escapedMatch}\\b` // Word boundary match
            : escapedMatch;
        const flags = caseSensitive ? 'g' : 'gi';
        const regex = new RegExp(pattern, flags);
        let newText = context.replace(regex, replaceWith);
        let message = new Shared.aiAgents.Classes.TextMessage({
            role: Shared.aiAgents.Constants.Roles.Tool, 
            mimeType: "text/plain", 
            textData: newText,
            toolName: "findAndReplaceTextTool",
            instructions: `Replace ${matchPhrase} with ${replaceWith} in the provided context.`
        });
        return Shared.v2Core.Helpers.Ok([message]);
    } catch (error) {
        return Shared.v2Core.Helpers.Err(`Error (findAndReplaceTextTool): ${error.message || error}`);
    }
}
