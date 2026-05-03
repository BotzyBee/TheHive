import { Services } from '../../SharedServices/index.js';

/*
PROCESS FLOW (Handles mutiple sources - frontend, telegram, email etc)
[input vars - text | source: ["frontendVoice", "telegramVoice", "email" etc ]
0. Gate-keeper (check source is allowed)
1. User messaage (text from STT, email, text message etc) 
2. Initial Triage & Answer (guides?)
    - If simple to answer, respond right away.
    else 
    - respond with holding message (if not email.)
    - start agent/ tool loop

AGENT / TOOL LOOP (spawn timer or as thread?)
1. Available actions
    - Memory / Context (what was the last job ref id.. what was the outcome again? remember.. xyz)
    - New Sub-Agent ( loop !)
    - Resume / Update Job ( loop !)
    - Get status/ update on sub-agent task ( should emit from loop... additional method to get result/ update again.)
*/

const Actions = [
  "'Reply Directly' : To reply directly to the user without calling any tools or sub-agents",
  "'Call Sub-Agent' : Passes the task to a sub-agent to perform tool calling and other longer-running activities. Also used to pass further information",
  "'Get Job Result' : For fetching an update or result of a previously submitted job.",
  "'Stop Job' : Used to stop a sub-agent's task.",
];

export async function BotzyAssistant(message, source, id) {
  // TO DO - GateKeeper FN

  // Triage Message
  let responseText = '';
  try {
    let ai = await Services.callAI.aiFactory();
    let act = Actions.join('\n \n');
    let sys = PromptsAndSchemas.triage.sys;
    let usr = PromptsAndSchemas.triage.usr(message, act);
    let call = await ai.generateText(sys, usr, {
      structuredOutput: PromptsAndSchemas.triage.schema,
    });
    if (call.isErr()) {
      throw new Error(
        `Ahh bloody typical, the clanker has thrown an error. Lets see... it says : ${call.value}`
      );
    }
    switch (call.value.action) {
      case 'Reply Directly':
        responseText = call.value.replyText;
        break;
      case 'Call Sub-Agent':
        break;
      case 'Get Job Result':
        break;
      case 'Stop Job':
        break;
    }
  } catch (error) {
    responseText = error;
  }
}

function BotzyAssistSubTaskManager() {}

export async function TestBotzyAgent(userText) {
  let ai = await Services.callAI.aiFactory();
  let sys =
    'You are a helpful aussie personal assistant called Botzy Bee. Interact with the user in a casual style. ' +
    'At all times you should be laid back but never seek to flatter. You should be honest, grounded and unbiased. ' +
    'Do not just agree with the user. Keep your answers short and punchy. Dont go into long dialogs unless the user has specifically asked of detail. ' +
    'Aim for just a couple of sentances. The user can always follow up.';
  let call = await ai.generateText(sys, userText); // { provider: Services.callAI.Constants.AiProviders.inception});
  if (call.isErr()) {
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

const PromptsAndSchemas = {
  triage: {
    sys:
      'GENERAL TONE: You are a helpful aussie personal assistant called Botzy Bee. Interact with the user in a casual style. ' +
      'At all times you should be laid back but never seek to flatter. You should be honest, grounded and unbiased. ' +
      'Do not simply agree with the user you should always aim for truthfulness. Keep your answers short and punchy. Dont go into long dialogs unless the user has specifically asked for detail. ' +
      'Aim for just a couple of sentances. The user can always follow up. \n \n' +
      'TASK: You are performing an initial triage of the users request - if the request is simple (for example basic conversation) then you should just reply to this. ' +
      'However, if the user is asking for a more complex task (something that requires tool calls, searching, IO functions etc) then you will pass these to a sub-agent whilst giving a brief response advising the user. ' +
      'A holding statement should be something like "Ok, Ill just go and check that for you" or "Ive asked one of my team to do XYZ for you. Ill get back to you with an update."',
    usr: (task, actions) => {
      return `Here is the user's message : ${task} \n \n Here are the available actions ${actions}`;
    },
    schema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The type of action to be performed.',
        },
        replyText: {
          type: 'string',
          description: 'The text content of the reply.',
        },
      },
      required: ['action', 'replyText'],
      additionalProperties: false,
    },
  },
};
