/*
    Uses The Hive Plugin Tool Standard
*/

export const details = {
    toolName:   "aiImageTool",
    version:    "2026.0.1",
    creator:    "Botzy Bee",
    overview:   "This tool uses AI to create or modify images.  \n"+
                "The AI Image tool can generate a variety of image types, graphics, landscapes, portraits." +
                "You can specify styles like line drawing, painting, photo-realistic etc. Images can be different aspect ratios and sizes."+
                "Images default to PNG format.", 
    guide:      null,  
    inputSchema: {
    "type": "object",
    "required": ["contentMessage"],
    "properties": {
        "contentMessage": {
        "type": "string",
        "description": "Input prompt for the AI to follow"
        },
        "options": {
        "type": "object",
        "properties": {
            "imageOptions": {
            "type": "object",
            "properties": {
                "aspectRatio": {
                "type": "string",
                "pattern": "^\\d+:\\d+$",
                "description": "e.g., 4:3, 16:9"
                },
                "resolution": {
                "type": "string",
                "description": "1K, 2K, 4K etc"
                },
                "contextImage": {
                "oneOf": [
                    { "$ref": "#/$defs/ImageMessage" },
                    { "type": "object" }
                ],
                "description": "Image to be edited or used as part of the process"
                }
            }
            }
        }
        }
    },
    "$defs": {
        "ImageMessage": {
        "type": "object",
        "properties": {
            "type": {
            "type": "string",
            "const": "image",
            "description": "Must always be 'image'"
            },
            "mime": {
            "type": "string",
            "description": "The mimeType of the image"
            },
            "url": {
            "type": "string",
            "format": "uri",
            "description": "Optional URL of the image"
            },
            "base64": {
            "type": "string",
            "description": "Base64 encoded image data"
            }
        },
        "required": ["type", "mime", "base64"]
        }
    }
    }
};

function safeEmit(agent, message){
    if(agent && typeof agent.emitUpdateStatus === "function"){
        agent.emitUpdateStatus(message);
    }
}

/**
 * Generates an Image using AI 
 * @param {string} contentMessage - Input prompt for the AI to follow 
 * @param {object} options
 * @param {object} [options.imageOptions] - Image Options (all optional)
 * @param {string}  [options.imageOptions.aspectRatio] - eg 4:3 16:9 etc
 * @param {string}  [options.imageOptions.resolution] - 1K, 2K, 4K etc
 * @param {ImageMessage | object} [options.imageOptions.contextImage] - Image to be edited or used as part of the process.
 * @returns {Result< [ImageMessage] | string > } - Result< ImageMessage | string >
 */
export async function run( 
    Shared, 
    params = {},
    agent = {}
){  
    // Destructure input
    const { contentMessage, options = {} } = params;
    const { aiSettings = {} } = agent || {};
    // Catch bad params
    if(contentMessage == null){
        return Shared.v2Core.Helpers.Err(`Error (aiImageTool) - Input contentMessage missing or null.`);
    }

    // Make the call
    safeEmit(agent, `Creating image using AI - 🤖🐝`);
    const aiCall = Shared.callAI.aiFactory();
    let call = await aiCall.generateImage(contentMessage, {...aiSettings, ...options})
    if(call.isErr()){
        return Shared.v2Core.Helpers.Err(`Error (aiImageTool -> Generate Image) : ${call.value}`);
    } 
    // Process Outputs
    for(let i in call.value){
        call.value[i].toolName = "aiImageTool";
        call.value[i].instructions = contentMessage;
        call.value[i].role = Shared.aiAgents.Constants.Roles.Tool;
    }
    if (agent && typeof agent.addAiCount === 'function') {
       agent.addAiCount(1);
    }
    return Shared.v2Core.Helpers.Ok(call.value); // already an array of messages
}

