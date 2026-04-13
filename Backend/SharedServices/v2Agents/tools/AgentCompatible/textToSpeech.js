/*
    Uses The Hive Plugin Tool Standard
*/
export const details = {
    toolName:   "textToSpeech",
    version:    "2026.0.1",
    creator:    "Botzy Bee",
    overview:   "This tool uses AI to create a audio message (base64) wav format from user provided text.  \n"+
                "The tool has options for single voice or multiple voices. Its also known as TTS or Text to Speech." +
                "Talk to me, Tell me, turn text into speech or audio.", 
    guide:      null,  
    inputSchema: {
        "type": "object",
        "required": [ "contentMessage"],
        "properties": {
            "contentMessage": {
                "type": "string",
                "description": "The text to be converted to speech"
            },
            "options": {
                "type": "object",
                "description": "Further options for the AI and TTS engine",
                "properties": {
                    "model": {
                        "type": "string",
                        "description": "Exact model string"
                    },
                    "provider": {
                        "type": "string",
                        "description": "AiProviders value"
                    },
                    "quality": {
                        "type": "number",
                        "minimum": 1,
                        "maximum": 3,
                        "description": "AiQuality value from 1 to 3"
                    },
                    "useWeb": {
                        "type": "boolean",
                        "description": "If true, AI uses web grounding"
                    },
                    "ttsOptions": {
                        "type": "object",
                        "description": "Object for voice configurations",
                        "properties": {
                            "gender": {
                            "type": "string",
                            "enum": ["Male", "Female"],
                            "description": "Specify if male or female voice should be used"
                            }
                        }
                    }
                }
            }
        }
    }
};

/**
 * Generates an audio (speech) from input text. 
 * @param {string} contentMessage - The text to be converted to speech
 * @param {object} options - further options
 * @param {string} [options.model] - Exact model string (optional)
 * @param {string} [options.provider] - AiProviders value (optional)
 * @param {number} [options.quality] - AiQuality value (optional) From 1 to 3.
 * @param {boolean} [options.useWeb] - If true, AI uses web grounding (Optional)
 * @param {object}  [options.ttsOptions] - Object for voice configurations (Optional)
 * @param {string}  [options.ttsOptions.gender ] - Optional, [ "Male" | "Female" ] specify if male or female voice should be used.
 * @returns {Result< [AudioMessage] | string > } - Result< AudioMessage | string >
 */
export async function run( 
    Shared, 
    params = {}
){  
    // Destructure input
    const { contentMessage, options } = params;
    // Catch bad params
    if(contentMessage == null){
        return Shared.Utils.Err(`Error (textToSpeech) - Input contentMessage missing or null.`);
    }

    // Make the call
    const aiCall = new Shared.AiCall.AiCall();
    let call = await aiCall.textToSpeech(contentMessage, options)
    if(call.isErr()){
        return Shared.Utils.Err(`Error (textToSpeech -> aiCall) : ${call.value}`);
    } 
    // Process Outputs
    for(let i in call.value){
        call.value[i].toolName = "textToSpeech";
        call.value[i].instructions = contentMessage;
        call.value[i].role = Shared.Classes.Roles.Tool;
    }
    return Shared.Utils.Ok(call.value); // already an array of messages
}

