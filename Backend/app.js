import express from 'express';
import cors from 'cors';
import {
  initDatabaseConnection,
  closeDatabaseConnection,
} from './SharedServices/Database/index.js';
import { SharedUtils } from './SharedServices/Utils/index.js';
import { setupPool, pool } from './Engine/worker.js';
import { Services } from './SharedServices/index.js';
import { indexTimerActive } from './Engine/worker.js';

export let dbAgent = null;
let servicesStarted = false;
let su = new SharedUtils();

// [][] -------------------------------------- [][]
// init function - setup db connections/ timers etc
// [][] -------------------------------------- [][]
const initServices = async () => {
  // only call once
  if (!servicesStarted) {
    // init Surreal DB agent
    let dbTools = await initDatabaseConnection();
    if (dbTools.isErr()) {
      su.log(`Error (initServices -> initDatabaseConnection ) : ${call.value}`);
      process.exit(1);
    }
    // Setup Piscina Pool
    setupPool();
    su.shortID;
    //Knowledgebase re-indexing timer (every 60 seconds)
    Services.coreTools.timers.addNewTimer(
      'KB_Indexing_Timer',
      async () => {
        if (!indexTimerActive) {
          await pool.run({}, { name: 'poolIndexKnowledgebase' });
        }
      },
      60000
    );
    // //New Job Scheduler (every 5 seconds)
    // Services.coreTools.timers.addNewTimer("New_Job_Scheduler", async () => {
    //     // Only call if not already busy
    //     if (!nonAllocTimerActive) {
    //         await checkNonAllocated();
    //     }
    // }, 5000);
    servicesStarted = true;
  }
};
// Express init
const app = express();
const port = 3000;
app.use(cors()); // Enable CORS for all origins <=== should be reviewed for production ****** )
app.use(express.json()); // Enable JSON body parsing

// Root endpoint: check if API is online
app.get('/', (req, res) => {
  res.status(200).send('The Hive is online 🐝');
});

// // AI Job endpoint: create a new AI job
// // This should be POST -- however using get for local testing
// app.get("/task", async (req, res) => {
//     let pmpt = req?.query?.prompt;
//     let userReview = req?.query?.userReview;
//     // Check inputs
//     if (!pmpt) {
//         return res.status(400).json({
//             error: `You need to include a prompt. userReview defaults to false if not provided.
// Example: /task?prompt='your task prompt here'&userReview='false'`
//         });
//     }
//     let UR;
//     // If userReview is 'false' or not provided, it's a single-shot job
//     if (!userReview || userReview === 'false') {
//         UR = false;
//     } else {
//         UR = true; // There will be a user review prior to tool calling.
//     }
//     // Create new job and return the ID number
//     let jobRef = await createAiJob(pmpt, UR);
//     res.setHeader("Content-Type", "text/plain; charset=utf-8");
//     return res.status(200).send(jobRef);
// });

// // Get AI job result
// app.get("/getResult", (req, res) => {
//     let jobID = req?.query?.jobID;
//     // Check inputs
//     if (jobID == undefined) {
//         return res.status(400).json({
//             error: `You need to include a jobID. Example: /getResult?jobID='JOB-XXXXX-XXXXX-XXXXX'`
//         });
//     }
//     let getJobUpdate = getUpdateOrResult(jobID); // returns Ok/ Err
//     if (getJobUpdate.isErr()){
//         log(`/getResult threw an error : ${JSON.stringify(getJobUpdate.value)}`);
//         return res.status(200).json({
//             response: getJobUpdate.value
//         });
//     }
//     return res.status(200).json({
//             response: getJobUpdate.value
//     });
// });

// // Amend or Auth an existing job
// // task: { amend: {prompt: "Your new prompt or instructions", jobID: "yourJobID" } }
// // task: { go: jobID }
// // task: { stop: jobID }
// app.post("/amendOrAuth", async (req, res) => {
//     let taskObjStr = req.body?.task;
//     // Check inputs
//     if (!taskObjStr || typeof taskObjStr != 'object') {
//         return res.status(400).json({
//             error: `You need to include a task. Example: /amendOrAuth?task='{amend: {prompt: "Your new prompt or instructions", jobID: "yourJobID" } }'`
//         });
//     }
//     let amOrAuthJob = await amendOrAuthorise(taskObjStr); // returns Ok(string) / Err(string)
//     if (amOrAuthJob.isErr()){
//         log(`/amendOrAuth threw an error : ${amOrAuthJob.value}`);
//         res.status(200).json({
//             response: amOrAuthJob.value
//         });
//     }
//     return res.status(200).json({
//             response: amOrAuthJob.value
//     });
// });

// // app.get("/test", async (req, res) => {
// //     let taskObjStr = req.query?.prompt;
// //     let arr = [];
// //     arr.push(taskObjStr);
// //     let x = await AiProjectPlanning(arr)
// //     let st = JSON.stringify({result: x});
// //         return res.status(200).json({
// //             response: st
// //     });
// // });

// // Temp API for testing different models
// app.get("/changeModel", async (req, res) => {
//     let provider = req.query?.provider;
//     let model =  req.query?.model;
//     setProviderAndModel(provider, model)
//     return res.status(200).json({
//             response: {provider: defaultAI, oai: oaiStandardModel, gem: gemiStandardModel}
//     });
// });

// [][] --- Server Start/ Graceful shutdown --- [][]
let server;
const startServer = () => {
  server = app.listen(port, () => {
    su.log(`Server running on port ${port}`);
  });
};
const gracefulShutdown = async (signal) => {
  su.log('Graceful Shutdown Started');

  // Stop the Express server from accepting new connections
  if (server) {
    server.close(() => {
      su.log('Server closed');
    });
  }

  // Clear all active timers
  Services.coreTools.timers.stopAndClearAllTimers();

  // Terminate the Piscina worker pool gracefully
  if (pool) {
    await pool.destroy();
  }

  // Close database connection
  await closeDatabaseConnection();

  su.log('Graceful shutdown complete. Exiting process.');
  process.exit(0); // Exit the process once all cleanup is done
};

// Listen for termination signals from Docker (SIGTERM) and Ctrl+C (SIGINT)
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// init services and start the server
initServices()
  .then(() => {
    startServer();
  })
  .catch((err) => {
    su.log(`Failed to start application: ${err.message}`);
    process.exit(1); // Exit if init
  });

// //    switch (aiResult.outcome) {
// //         case Outcome.SUCCESS:
// //             // Sucess Result
// //             res.setHeader("Content-Type", "text/plain; charset=utf-8");
// //             res.status(200).send(aiResult.data)
// //             break;
// //         case Outcome.FAILURE:
// //             console.log("ERROR Sending response - ", aiResult.data);
// //             return res.status(500).json({ error: "Sorry there has been an internal server error and no result could be generated" });
// //             break;
// //         case Outcome.NORES:
// //             console.log("NO Result from Pinecone - Prompt : ", pmpt);
// //             res.status(200).send(`Sorry I could not find any information in my files to answer that question.`);
// //             break;
// //         default:
// //             return res.status(500).json({ error: "Sorry there has been an internal server error and no result could be generated" });
// //     }
//     // if (!pmpt || !ac){
//     //     return res.status(400).json({ error: "You need to include a prompt and AC code /ask?prompt='your question here'&ac=abc123" });
//     // }
//         // // not authorised
//         // return res.status(401).json({ error: "Not authorised - Contact Policing Smarter DevTeam if this issue persists" });

// // app.post("/checkCR", async (req, res) => {
// //     let report = req.body.report;
// //     let ac = req.body.ac;
