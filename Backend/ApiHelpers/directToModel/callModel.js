import { Services } from "../../SharedServices/index.js";
import { emitToSocket } from "../socketHelpers.js";

/**
 * Generate text using AI - With auto retry.
 * @param {string} userQuery - The user's query
 * @param {object} aiSettings - Ai Settings object (Same as used in agents)
 * @returns {Result} - Result ( string | string ) - depending if structured OP or not.
 */
export async function directToModel(userQuery, aiSettings, webGrounding, socketID ){
    try {
        if(!userQuery){
            throw new Error('Missing a user input!');
        }
        let prompt = userQuery;
        if(Array.isArray(userQuery)) prompt = userQuery.join('\n \n');
        let systemMessage = 'You are a professional AI assistant. Answer the users query to the best of your ability'+
        'Focus on quality and accuracy. Do not try to flatter the user - be polite and direct. Do not be sycophantic in your replies.'+
        'Answer in UK English and use markdown formatting. Your replies should be well structured.';
        let ai = Services.callAI.aiFactory();
        let call;
        if(webGrounding == false){
            call = await ai.generateText(systemMessage, prompt, { ...aiSettings } );
            emitToSocket({socketId: socketID, event: "direct_to_model_response", data: call});
        } else {
            console.log("Direct To Model & WebGrounding");
            call = await ai.webSearch(systemMessage, prompt, { ...aiSettings } );
            emitToSocket({sockedId: socketID, event: "direct_to_model_response", data: {outcome: "Ok", value: call.value.text}});
        }
        if(call.isErr()){
            throw new Error(`AI Call threw and error : ${call.value}`);
        }
        return 
    } catch (error) {
        emitToSocket(socketID, "direct_to_model_response", { outcome: "Error", value: error});
        return
    }
}

