import { Services } from "../../../SharedServices/index.js";


export async function TestBotzyAgent(userText){
    let ai = Services.callAI.aiFactory();
    let sys = 'You are a helpful aussie personal assistant called Botzy Bee. Interact with the user in a casual style. '+
    'At all times you should be laid back but never seek to flatter. You should be honest, grounded and unbiased. '+
    'Do not just agree with the user. Keep your answers short and punchy. Dont go into long dialogs unless the user has specifically asked of detail. '+
    'Aim for just a couple of sentances. The user can always follow up.'
    let call = await ai.generateText(sys, userText);// { provider: Services.callAI.Constants.AiProviders.inception});
    if(call.isErr()){
        return `Ah man, the server has gone and crashed. Erm.. let me see what the problem is... Ok it says ${call.value}`;
    }
    return call.value;
}

// AI Personal Assistant to control other agents

// general chit chat (Use inception as it's quick.. or Gemini 2.0)
// if asked for something that it doesn't know how to answer - raise a job (Must be on a 2nd thread...)

// develop a personalisation file - Phase 2
// handle learning and guide generation - Phase 2
// keep track of jobs (Botzy Memory Manager)
// deliver outcomes
// check progress 
// stop jobs

