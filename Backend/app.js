import express from 'express';
import cors from 'cors';
import {
  initDatabaseConnection,
  closeDatabaseConnection,
} from './SharedServices/Database/index.js';
import * as su from './SharedServices/Utils/index.js';
import { setupPool, pool } from './Engine/workers.js';
import { Services } from './SharedServices/index.js';
import { indexTimerActive } from './Engine/workers.js';
import { writeLogsToFile } from './SharedServices/Utils/misc.js';

export let dbAgent = null;
let servicesStarted = false;

// [][] -------------------------------------- [][]
// init function - setup db connections/ timers etc
// [][] -------------------------------------- [][]
const initServices = async () => {
  // only call once
  if (!servicesStarted) {
    // init Surreal DB agent
    let dbTools = await initDatabaseConnection(false);
    if (dbTools.isErr()) {
      su.log(`Error (initServices -> initDatabaseConnection ) : ${call.value}`);
      process.exit(1);
    }
    // Setup Piscina Pool
    setupPool();

    //Knowledgebase re-indexing timer (every 60 seconds)
    Services.CoreTools.Timers.addNewTimer(
      'KB_Indexing_Timer',
      async () => {
        if (!indexTimerActive) {
          await pool.run({}, { name: 'poolIndexKnowledgebase' });
        }
      },
      60000
    );

    //New Job Scheduler (every 5 seconds)
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
  Services.CoreTools.Timers.stopAndClearAllTimers();
  // Print logs to file
  await writeLogsToFile();

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
