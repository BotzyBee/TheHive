
/*
This file provides a single place to call functions which will be run in their own thread.
Functions in this file should be prefixed 'pool' and simply call their normal counterparts in other files.
Worker.js is a proxy or middleware;
REMEMBER - Threads cannot access the global vars on the main thread... they have their own copy which needs populated and merged back.
*/

import { Piscina } from "piscina";
// import { indexKnowledgebase } from './cron_jobs/fileIndexing.js';
// import { writeLogsToFile } from './utils.js';
// import { getDbAgent } from './DB/CRUD.js';
// import { Err, Ok } from './sharedTypes.js';
// import { AIAgent } from "../AI/genericAgent/main.js";
// import { AiJobEngine } from "../AI/engine/main.js";

export let indexTimerActive = false;
export let pool; // Piscina worker pool (multi-thread)

export function setupPool() {
    pool = new Piscina({
        filename: new URL("./worker.js", import.meta.url).href,
        minThreads: 2, // Minimum number of worker threads to keep alive
        maxThreads: 4  // Maximum number of worker threads
    });
}

// export async function poolIndexKnowledgebase(){
//     indexTimerActive = true;
//     let dbAgent = await getDbAgent();
//     if(dbAgent.isOk()){
//         let call = await indexKnowledgebase(dbAgent.value);
//         await writeLogsToFile(); // write app logs to AppfileDir 
//         indexTimerActive = false;
//         return call;
//     } else {
//         await writeLogsToFile();
//         indexTimerActive = false;
//         return Err(`ERROR - (poolIndexKnowledgebase -> getDbAgentdbAgent) : ${dbAgent.value}`);
//     }
// }

// // Process AI JOB 
// export async function poolAiJobEngine({jobClassObject}){
//     // Create new AI Agent in thread 
//     let params = {};
//     params.userPlanReview = jobClassObject.userPlanReview;
//     params.conversationHistory = jobClassObject.conversationHistory;
//     params.tools = jobClassObject.tools;
//     params.aiProvider = jobClassObject.aiProvider;
//     params.aiProviderLarge = jobClassObject.aiProviderLarge;
//     params.maxIterations = jobClassObject.maxIterations;
//     let task = new AIAgent(params);
//     // Make the Call
//     let call = await AiJobEngine(task);
//     if(call.isErr()){
//         return Err({
//                 jobClassObject: call.value.jobClassObject,
//                 errorText: `Error (poolAiJobEngine -> AiJobEngine) : ${call.value.errorText}`
//             })
//     }
//     return Ok(call.value); // Note non-standard Err() format! 
// }


// [][] -------------------------------------------------------------------------- [][]
// Example functions in worker.js
// export function poolAdd ({ a, b }) { return add({a, b})}  // 'add' could be any regular JS function.
// export function poolMultiply ({ a, b }) { return Multiply ({ a, b }) }; // 


// USE THIS CODE TO CALL POOL WORKER FUNCTION FROM OTHER JS FILES
// import { Piscina } from "piscina";

// const pool = new Piscina({
//   filename: new URL("./utils/worker.js", import.meta.url).href,
// });

// const result = await piscina.run({ a: 4, b: 6 }, {name: 'poolMultiply'});

// or

// console.log(await Promise.all([
//   pool.run({ a: 2, b: 3 }, { name: 'poolAdd' }),
//   pool.run({ a: 2, b: 3 }, { name: 'poolMultiply' })
// ]));
