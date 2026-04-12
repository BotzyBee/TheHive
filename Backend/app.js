import { createServer } from 'http';
import { Server } from 'socket.io';
import express from 'express';
import cors from 'cors';
import {
  initDatabaseConnection,
  closeDatabaseConnection,
} from './SharedServices/Database/index.js';
import { setupPool, pool, indexTimerActive } from './Engine/workers.js';
import * as Timers from './SharedServices/CoreTools/timers.js';
import * as Classes from './SharedServices/Classes/index.js';
import * as Utils from './SharedServices/Utils/misc.js';
import { writeLogsToFile } from './SharedServices/Utils/misc.js';
import { getConfigForFrontend } from './Engine/routes/index.js';
import { initToolIndex } from './Engine/toolIndex.js';
import { initGuideIndex } from './Engine/guideIndex.js';
import { handleQAMessage } from './Engine/routes/quickAsk.js';
import { handleTAMessage } from './Engine/routes/taskAgent.js';
import { JOBS } from './Engine/jobManager.js';
import { indexKnowledgebase,  } from './Engine/buildKbIndex.js';
import { getFormattedModelRegistry } from './SharedServices/CallAI/utils.js';
import { getDbAgent } from './SharedServices/Database/utils.js';
import { isMainThread } from 'node:worker_threads';
import { testDrive, rustActionState } from './SharedServices/CoreTools/webDriver/engine.js'; // TESTING ONLY - REMOVE LATER

let dbAgent; // Global variable to hold the database agent instance
let servicesStarted = false;

// [][] -------------------------------------- [][]
//                init function
//        setup db connections/ timers etc
// [][] -------------------------------------- [][]
const initServices = async () => {
  if (!isMainThread) return;

  // only call once
  if (!servicesStarted) {
    console.log(`Services status: ${servicesStarted} . DB Agent: ${dbAgent} `);
    // init Surreal DB agent
    console.log('Initializing database connection...');
    let dbTools = await initDatabaseConnection(false);
    if (dbTools.isErr()) {
      Utils.log(`Error (initServices -> initDatabaseConnection ) : ${dbTools.value}`);
      process.exit(1);
    }
    dbAgent = dbTools.value;
    // Setup Piscina Pool
    setupPool(); // Picina is broken at the moment (doesn't play well with ESM modules / SurrealDB)
    // Load Tools
    console.log(' \n\n'+ '[][] ---------------------- [][] \n\n');
    Utils.log("Loading Tools...");
    let tools = await initToolIndex();
    if(tools.isErr()){
      Utils.log(`Error (initServices -> initToolIndex ) : ${tools.value}`);
      process.exit(1);
    }
    Utils.log(`${tools.value.tools} Tools loaded. \n`+
      `${tools.value.added} new. \n`+
      `${tools.value.updated} updated \n`+
      `${tools.value.removed} removed.`)

    // Load Guides
    console.log(' \n\n'+ '[][] ---------------------- [][] \n\n');
    Utils.log("Loading Guides...");
    let guides = await initGuideIndex();
    if(guides.isErr()){
      Utils.log(`Error (initServices -> initGuideIndex ) : ${guides.value}`);
      process.exit(1);
    }
    Utils.log(`${guides.value.guides} Guides loaded. \n`+
      `${guides.value.added} new. \n`+
      `${guides.value.updated} updated \n`+
      `${guides.value.removed} removed.`)

    //Knowledgebase re-indexing timer (every 60 seconds)
    Timers.addNewTimer(
      'KB_Indexing_Timer',
      async () => {
        if (!indexTimerActive) {
          console.log("Running KB Indexing...");
          let poolCall = await pool.run({}, {name: 'poolIndexKnowledgebase'})
        }
      },
      { delay: 0, intervalMs: 60000, isOneOff : false }
    );

    //New Job Scheduler (every 5 seconds)
    Timers.addNewTimer("New_Job_Scheduler", async () => {
        // Only call if not already busy
        if (JOBS.isAllocatorActive() == false) {
            await JOBS.checkNonAllocated();
        }
    }, { delay: 0, intervalMs: 5000, isOneOff : false });

    // Prune completed jobs every 10 mins
    Timers.addNewTimer("Prune_Completed_Jobs", async () => {
      await JOBS.jobListManager({ prune: true });
    }, { delay: 0, intervalMs: 600000, isOneOff : false });

    // Write logs to file every 2 mins
    Timers.addNewTimer("Write_Logs_To_File", async () => {
      await writeLogsToFile();
    }, { delay: 0, intervalMs: 120000, isOneOff : false });
    servicesStarted = true;
  }
};
// init express 
export const app = express();
const port = 3000;
app.use(cors());
app.use(express.json());

// 1. Create the explicit HTTP server (wrapping the Express app)
const httpServer = createServer(app);

// 2. Initialize Socket.io
export const io = new Server(httpServer, {
  cors: {
    origin: "*", // Matches your current Express CORS logic
    methods: ["GET", "POST"]
  }
});

// [][] -------------------------------------- [][]
//                 API ENDPOINTS
// [][] -------------------------------------- [][]

// Root endpoint: check if API is online
app.get('/', (req, res) => {
  res.status(200).send('The Hive is online 🐝');
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

// ALL - Get Update or Result
app.get("/stopJob", async (req, res) => {
  const jobID = req.query?.jobID || null;
  if(jobID == null ){ 
    return res.status(400).json({
        error: `Error : JobID parameter is missing or null!`
    });
  }
  let msg = await JOBS.jobListManager({stopJob: jobID});
  if(msg.isErr()){ return res.status(400).json({error: msg.value}) }
  // format as Frontend Message Format. 
  let rtnMsg = new Classes.FrontendMessageFormat({
    aiJobId: jobID,
    status: Classes.Status.Stopped,
    isRunning: false,
    messages: [ new Classes.TextMessage(
      { role: Classes.Roles.Agent, 
        textData: `Job ${jobID} has been stopped.` })
      ],
    metadata: {}
  });
  res.status(200).json(rtnMsg);
});

app.get("/getConfig", async (req, res) => {
  let msg = getConfigForFrontend();
  res.status(200).json(msg);
});

app.get("/getModels", async (req, res) => {
  let msg = getFormattedModelRegistry();
  res.status(200).json(msg);
});

app.get("/test", async (req, res) => {
  let prompt = res.req.query?.prompt || null;
  let webUrl = res.req.query?.webUrl || null;
  if(prompt == null || webUrl == null){ 
    return res.status(400).json({
        error: `Error : prompt or webUrl parameter is missing or null!`
    });
  }
  let msg = await testDrive(prompt, webUrl);
  if(msg.isErr()){ return res.status(400).json({error: msg.value}) }
  res.status(200).json(msg.value);
});


// [][] -------------------------------------- [][]
//                 WEBSOCKET EVENTS
// [][] -------------------------------------- [][]
export let connectedSockets = []; // shoud only be one for now but can be used for multi-user features in the future.

// helper function to emit to a specific socket (used for pushing updates to the correct user for their jobs)
export const emitToSocket = (socketId, event, data) => {
  const socket = io.sockets.sockets.get(socketId); 
  if (socket) {
    socket.emit(event, data);
  } else {
    Utils.log(`Warning: Socket ${socketId} not found for event "${event}"`);
  }
};

//Handle Socket.io connections
io.on('connection', (socket) => {
    Utils.log(`User joined: ${socket.id}`);

    // --- 1. SUBMIT TASK (Task Agent) ---
    socket.on('submit_task', async (data, callback) => {
      console.log("Task Agent Job Received");
        const frontendMessage = data?.fmf || null;
        if (!frontendMessage) {
            return callback({ error: "fmf is missing or invalid" });
        }

        // Start the background process
        let result = await handleTAMessage(frontendMessage, socket.id);
        
        if (result.isErr()) {
            return callback({ error: result.value });
        }

        // Acknowledge receipt and send initial JobID back to frontend
        callback(result.value);
    });

    // --- 2. SUBMIT QUICK ASK ---
    socket.on('submit_quick_ask', async (data, callback) => {
      console.log("Quick Ask Job Received");
        const frontendMessage = data?.fmf || null;
        if (!frontendMessage) return callback({ error: "fmf is missing" });
        
        let result = await handleQAMessage(frontendMessage, socket.id);
        if (result.isErr()) return callback({ error: result.value });

        callback(result.value);
    });

    // --- 3. STOP JOB ---
    socket.on('stop_task', async (data, callback) => {
        const jobID = data?.jobID;
        if (!jobID) return callback({ error: "JobID missing" });

        let msg = await JOBS.jobListManager({ stopJob: jobID });
        if (msg.isErr()) return callback({ error: msg.value });

        const rtnMsg = new Classes.FrontendMessageFormat({
            aiJobId: jobID,
            status: Classes.Status.Stopped,
            isRunning: false,
            messages: [new Classes.TextMessage({ 
                role: Classes.Roles.Agent, 
                textData: `Job ${jobID} has been stopped.` 
            })]
        });
        callback(rtnMsg);
    });

    // Existing rust logic
    socket.on('take-action-result', (data) => {
        rustActionState.result = data;
        console.log('Received result from Rust WebDriver:', JSON.stringify(data));
    });

    socket.on('disconnect', () => {
        Utils.log(`User left: ${socket.id}`);
    });
});


// [][] -------------------------------------- [][]
//             LISTENERS & SERVER START
// [][] -------------------------------------- [][]

let server;
const startServer = () => {
  server = httpServer.listen(port, () => {
    Utils.log(`Server running on port ${port} (HTTP + WS)`);
  });
};

// [][] --- Graceful Sutdown --- [][]
const gracefulShutdown = async (signal) => {
  Utils.log('Graceful Shutdown Started');
  
  if (io) {
    await io.close(); // Close all websocket connections
    Utils.log('Socket.io closed');
  }

  if (server) {
    server.close(() => {
      Utils.log('HTTP Server closed');
    });
  }
  // Clear all active timers
  CoreTools.Timers.stopAndClearAllTimers();
  // Print logs to file
  await writeLogsToFile();
  // Terminate the Piscina worker pool gracefully
  if (pool) { await pool.destroy();}
  // Close database connection
  await closeDatabaseConnection();
  Utils.log('Graceful shutdown complete. Exiting process.');
  process.exit(0); // Exit the process once all cleanup is done
};
// Listen for termination signals from Docker (SIGTERM) and Ctrl+C (SIGINT)
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// [][] -- Init & Trigger Start -- [][]
initServices()
  .then(() => {
    if (!isMainThread) return;
    startServer();
  })
  .catch((err) => {
    Utils.log(`Failed to start application: ${err.message}`);
    process.exit(1); // Exit if init
  });