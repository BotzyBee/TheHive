/*
This file provides a single place to call functions which will be run in their own thread.
Functions in this file should be prefixed 'pool' and simply call their normal counterparts in other files.
Worker.js is a proxy or middleware;
REMEMBER - Threads cannot access the global vars on the main thread... they have their own copy which needs populated and merged back.
*/
import { Piscina } from 'piscina';
// import { getDbAgent } from '../SharedServices/Database/index.js';
// import { indexKnowledgebase } from './buildKbIndex.js'; 
import * as su from '../SharedServices/Utils/index.js';
import { AiJob } from '../SharedServices/Classes/index.js';
import { QuickAskAgent } from '../SharedServices/Agents/QuickAsk/index.js';


/**@type {Piscina} */
export let pool; // Piscina worker pool (multi-thread)

export function setupPool() {
  pool = new Piscina({
    filename: new URL('./workers.js', import.meta.url).href,
    minThreads: 2, // Minimum number of worker threads to keep alive
    maxThreads: 4, // Maximum number of worker threads
  });
}

// export async function poolIndexKnowledgebase(){
//     indexTimerActive = true;
//     let dbAgent = await getDbAgent();
//     if(dbAgent.isOk()){
//         let call = await indexKnowledgebase(dbAgent.value);
//         indexTimerActive = false;
//         return call;
//     } else {
//         indexTimerActive = false;
//         return su.Err(`ERROR - (poolIndexKnowledgebase -> getDbAgentdbAgent) : ${dbAgent.value}`);
//     }
// }

// Process AI JOB
export async function poolRunAiJob({jobClassObject}){
    let job = processObjectToClass(jobClassObject); 
    if(job == null){ return su.Err('Error (poolRunAiJob) - could not re-instantiate the job class object') }
    // Run the Job
    let call = await job.run();
    if(call.isErr()){ return su.Err({errorText: call.value, jobObject: job }) }; // has Result, return error.
    return su.Ok(job); // return class
}

/**
 * Re-instantiate class after thread hand-off
 * @param {object} jobClassObject - Instance of AiJob or sub-class.
 * @returns - the associated class object.
 */
export function processObjectToClass(jobClassObject){
    let rtn = null;
    switch (jobClassObject.agentType) {
        case "AiJob": // Base Class
            rtn = new AiJob().import(jobClassObject);
        case "QuickAsk":
            rtn = new QuickAskAgent().import(jobClassObject);
    }
    return rtn;
}

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
