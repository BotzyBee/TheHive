import { createServer } from 'http';
import { Server } from 'socket.io';
import express from 'express';
import cors from 'cors';
import { initServices, shutdownServices } from './ApiHelpers/manageServices.js';
import { io } from './ApiHelpers/socketHelpers.js'; 
import { getConfigForFrontend, stopJob } from './ApiHelpers/miscHelpers.js';
import { getFormattedModelRegistry } from './SharedServices/v2CallAI/core/utils.js';
import { handleTAMessage } from './SharedServices/v2Agents/engine/taskAgent.js';
import { handleQAMessage } from './SharedServices/v2Agents/engine/quickAsk.js';
import { log } from './SharedServices/v2Core/core/helperFunctions.js';
import { isMainThread } from 'node:worker_threads';
import { directToModel } from './ApiHelpers/directToModel/callModel.js';
import { handleFrontendConnection } from './ApiHelpers/speechService/socketFns.js';

// [][] -------------------------------------- [][]
//                init server
// [][] -------------------------------------- [][]
console.log("Starting The Hive API Server..."); 
// Init Express server.
const app = express(); 
const port = 3000;
app.use(cors()); 
app.use(express.json());
const httpServer = createServer(app); //Create the explicit HTTP server (wrapping the Express app)
// Init Socket.io
io.value = new Server(httpServer, {
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

app.get("/getConfig", async (req, res) => {
  let msg = getConfigForFrontend();
  res.status(200).json(msg);
});

app.get("/getModels", async (req, res) => {
  let msg = getFormattedModelRegistry();
  res.status(200).json(msg);
});

// app.get("/test", async (req, res) => {
//   let prompt = res.req.query?.prompt || null;
//   let webUrl = res.req.query?.webUrl || null;
//   if(prompt == null || webUrl == null){ 
//     return res.status(400).json({
//         error: `Error : prompt or webUrl parameter is missing or null!`
//     });
//   }
//   let msg = await testDrive(prompt, webUrl);
//   if(msg.isErr()){ return res.status(400).json({error: msg.value}) }
//   res.status(200).json(msg.value);
// });


// [][] -------------------------------------- [][]
//                 WEBSOCKET EVENTS
// [][] -------------------------------------- [][]
 // shoud only be one for now but can be used for multi-user features in the future.

//Handle Socket.io.value connections

io.value.on('connection', (socket) => {
    log(`User joined: ${socket.id}`);

    // --- TASK AGENT JOB ---
    socket.on('submit_task', async (data, callback) => {
      console.log("Task Agent Job Received");
        const frontendMessage = data?.fmf || null;
        if (!frontendMessage) return callback({ error: "fmf is missing" });
        let result = await handleTAMessage(frontendMessage, socket.id);
        if (result.isErr()) { return callback({ error: result.value }); }
        callback(result.value);
    });

    // --- QUICK-ASK AGENT JOB ---
    socket.on('submit_quick_ask', async (data, callback) => {
      console.log("Quick Ask Job Received");
        const frontendMessage = data?.fmf || null;
        if (!frontendMessage) return callback({ error: "fmf is missing" });
        let result = await handleQAMessage(frontendMessage, socket.id);
        if (result.isErr()) return callback({ error: result.value });

        callback(result.value);
    });

    // --- STOP JOB ---
    socket.on('stop_task', async (data, callback) => {
        const jobID = data?.jobID;
        if (!jobID) return callback({ error: "JobID missing" });
        let res = stopJob(jobID);
        callback(res);
    });

    // --- CALL MODEL DIRECTLY ---
    socket.on('direct_to_model', async (data, callback) => {
      console.log("Direct to Model Call...");
      await directToModel(data.query, data.aiSettings, data.webGrounding, socket.id);
    });

    // Existing rust logic
    // socket.on('take-action-result', (data) => {
    //     rustActionState.result = data;
    //     console.log('Received result from Rust WebDriver:', JSON.stringify(data));
    // });

    socket.on('disconnect', () => {
        log(`User left: ${socket.id}`);
    });
});

// [][] --- CHAT BOTZY WS ROUTE --- [][]
io.value.of('/chat_botzy').on('connection', (socket) => {
  console.log("Chat Botzy Active");
    handleFrontendConnection(socket).catch(err => {
        console.error('Chat Botzy Socket Failed:', err);
        socket.disconnect(true);
    });
});

// [][] -------------------------------------- [][]
//             LISTENERS & SERVER START
// [][] -------------------------------------- [][]
let server;
const startServer = () => {
  server = httpServer.listen(port, () => {
    log(`Server running on port ${port} (HTTP + WS)`);
  });
};

// [][] --- Graceful Sutdown --- [][]
const gracefulShutdown = async (signal) => {
  log('Graceful Shutdown Started');
  if (io.value) {
    await io.value.close(); // Close all websocket connections
    log('Socket.io closed');
  }
  if (server) {
    server.close(() => {
      log('HTTP Server closed');
    });
  }
  await shutdownServices();
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
    log(`Failed to start application: ${err.message}`);
    process.exit(1); // Exit if initialization fails
  });