import express from 'express';
import cors from 'cors';
import {
  initDatabaseConnection,
  closeDatabaseConnection,
} from './SharedServices/Database/index.js';
import { setupPool, pool } from './Engine/workers.js';
import { Services } from './SharedServices/index.js';
import { indexTimerActive } from './Engine/workers.js';
import { writeLogsToFile } from './SharedServices/Utils/misc.js';
import { getToolDetails } from './SharedServices/Database/index.js';
import { initToolIndex } from './Engine/toolIndex.js';
import { handleQAMessage } from './Engine/routes/quickAsk.js';
import { handleTAMessage } from './Engine/routes/taskAgent.js';
import { JOBS } from './Engine/jobManager.js';

export let dbAgent = null;
let servicesStarted = false;

// [][] -------------------------------------- [][]
//                init function
//        setup db connections/ timers etc
// [][] -------------------------------------- [][]
const initServices = async () => {
  // only call once
  if (!servicesStarted) {
    // init Surreal DB agent
    let dbTools = await initDatabaseConnection(false);
    if (dbTools.isErr()) {
      Services.Utils.log(`Error (initServices -> initDatabaseConnection ) : ${call.value}`);
      process.exit(1);
    }
    // Setup Piscina Pool
    setupPool();
    // Load Tools
    Services.Utils.log("Loading Tools...");
    let tools = await initToolIndex();
    if(tools.isErr()){
      Services.Utils.log(`Error (initServices -> initToolIndex ) : ${tools.value}`);
      process.exit(1);
    }
    Services.Utils.log(`${tools.value.tools} Tools loaded. \n`+
      `${tools.value.added} are new. \n`+
      `${tools.value.updated} were updated \n`+
      `${tools.value.removed} were removed.`)
    
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
    Services.CoreTools.Timers.addNewTimer("New_Job_Scheduler", async () => {
        // Only call if not already busy
        if (JOBS.isAllocatorActive() == false) {
            await JOBS.checkNonAllocated();
        }
    }, 5000);
    servicesStarted = true;
  }
};
// Express init
export const app = express();
const port = 3000;
app.use(cors()); // Enable CORS for all origins <=== should be changed if not running locally !!)
app.use(express.json()); // Enable JSON body parsing

// [][] -------------------------------------- [][]
//                 API ENDPOINTS
// [][] -------------------------------------- [][]

// Root endpoint: check if API is online
app.get('/', (req, res) => {
  res.status(200).send('The Hive is online 🐝');
});

// QuickAsk Agent Endpoint
app.post("/quickAsk", async (req, res) => {
  const frontendMessage = req.body?.fmf || null;
  if(frontendMessage == null ){ 
    return res.status(400).json({
        error: `Error : fmf is either missing or not a FrontendMessageFormat`
    });
  }
  let msg = await handleQAMessage(frontendMessage);
  if(msg.isErr()){ return res.status(400).json({error: msg.value}) }
  res.status(200).json(msg.value);
});

// Task Agent Endpoint
app.post("/taskAgent", async (req, res) => {
  const frontendMessage = req.body?.fmf || null;
  if(frontendMessage == null ){ 
    return res.status(400).json({
        error: `Error : fmf is either missing or not a FrontendMessageFormat`
    });
  }
  let msg = await handleTAMessage(frontendMessage);
  if(msg.isErr()){ return res.status(400).json({error: msg.value}) }
  res.status(200).json(msg.value);
});

// ALL - Get Update or Result
app.get("/getUpdate", async (req, res) => {
  const jobID = req.query?.jobID || null;
  if(jobID == null ){ 
    return res.status(400).json({
        error: `Error : JobID parameter is missing or null!`
    });
  }
  let msg = await JOBS.getUpdateOrResult(jobID);
  if(msg.isErr()){ return res.status(400).json({error: msg.value}) }
  res.status(200).json(msg.value);
});

// Test Endpoint: for testing 
app.get('/test', async (req, res) => {
  let tsk = req?.query?.tool;
  let x = await getToolDetails(tsk);
  //let x = await Services.CoreTools.AgentCompatible.readFile.run( Services, { filePath : 'UserFiles/testing/A.txt' } );
  //console.log(x);
  res.status(200).json({result: x });
});

// [][] -------------------------------------- [][]
//             LISTENERS & SERVER START
// [][] -------------------------------------- [][]

let server;
const startServer = () => {
  server = app.listen(port, () => {
    Services.Utils.log(`Server running on port ${port}`);
  });
};

// [][] --- Graceful Sutdown --- [][]
const gracefulShutdown = async (signal) => {
  Services.Utils.log('Graceful Shutdown Started');
  // Stop the Express server from accepting new connections
  if (server) {
    server.close(() => {
      Services.Utils.log('Server closed');
    });
  }
  // Clear all active timers
  Services.CoreTools.Timers.stopAndClearAllTimers();
  // Print logs to file
  await writeLogsToFile();
  // Terminate the Piscina worker pool gracefully
  if (pool) { await pool.destroy();}
  // Close database connection
  await closeDatabaseConnection();
  Services.Utils.log('Graceful shutdown complete. Exiting process.');
  process.exit(0); // Exit the process once all cleanup is done
};
// Listen for termination signals from Docker (SIGTERM) and Ctrl+C (SIGINT)
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// [][] -- Init & Trigger Start -- [][]
initServices()
  .then(() => {
    startServer();
  })
  .catch((err) => {
    Services.Utils.log(`Failed to start application: ${err.message}`);
    process.exit(1); // Exit if init
  });