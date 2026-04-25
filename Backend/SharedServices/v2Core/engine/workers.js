/*
This file provides a single place to call functions which will be run in their own thread.
Functions in this file should be prefixed 'pool' and simply call their normal counterparts in other files.
Worker.js is a proxy or middleware;
REMEMBER - Threads cannot access the global vars on the main thread... they have their own copy which needs populated and merged back.
*/

import { initRegistry } from '../../../ApiHelpers/buildRegistry.js';
import { Services } from '../../index.js';
import { TaskAgent } from '../../v2Agents/services/TaskAgent/index.js';
import { QuickAskAgent } from '../../v2Agents/services/QuickAsk/index.js';
import { parentPort } from 'worker_threads';

let indexTimerActive = false

// Bootstrap the Services in the worker thread.
let isInitialized = false;
function bootstrapServices() {
  if (isInitialized) return;
  initRegistry();
  isInitialized = true;
}

export async function poolIndexKnowledgebase(){
    bootstrapServices();
    indexTimerActive = true;
    let dbAgent = await Services.database.ManageDb.getDbAgent();
    if(dbAgent.isErr()){
        indexTimerActive = false;
        console.log(`Error getting DB Agent in poolIndexKnowledgebase: ${dbAgent.value}`);
        return; 
    }
    let call = await Services.database.indexKnowledgebase(dbAgent.value);
    indexTimerActive = false;
    return call;
}

// Process AI JOB
export async function poolRunAiJob({jobClassObject, agentType}){
    let job = await processObjectToClass(jobClassObject, agentType); 
    if(job == null){ return Services.v2Core.Helpers.Err('Error (poolRunAiJob) - could not re-instantiate the job class object') }
    // Run the Job
    let call = await job.run();
    if(call.isErr()){ return Services.v2Core.Helpers.Err({errorText: call.value, jobObject: job }) }; // has Result, return error.
    // wait 3 secs to allow emit functions to complete
    await new Promise(res => setTimeout(res, 3000));
    // remove functions prior to sending back.
    job.aiCall = null;
    job.emitToSocket = null;
    return Services.v2Core.Helpers.Ok(job); // return class
}

/**
 * Re-instantiate class after thread hand-off
 * @param {object} jobClassObject - Instance of AiJob or sub-class.
 * @returns - the associated class object.
 */
export async function processObjectToClass(jobClassObject, agentType){
    const poolEmitToSocket = ({socketId, event, data}) => {
        parentPort.postMessage({
        socketId: socketId,
        event: event,
        data: data
        });
    };

    let instance;
    let callFactory = await Services.callAI.aiFactory(); // add aiCall function

    switch (agentType) {
        case "AiJob": // Base Class
            let job = new Services.aiAgents.Classes.AiJob({emitFunction: poolEmitToSocket, callFactory: callFactory});
            instance = job.import(jobClassObject);
            break;
        case "QuickAsk":
            instance = new QuickAskAgent({emitFunction: poolEmitToSocket, callFactory: callFactory}).import(jobClassObject);
            break;
        case "TaskAgent":
            instance = new TaskAgent({emitFunction: poolEmitToSocket, callFactory: callFactory}).import(jobClassObject);
            break;
    }
    instance.emitToSocket = poolEmitToSocket; // add pool emit function;
    instance.aiCall = Services.callAI.aiFactory(); // add aiCall function
    return instance;
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
