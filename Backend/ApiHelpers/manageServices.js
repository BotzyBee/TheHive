import { initRegistry } from "./buildRegistry.js";
import { isMainThread } from 'node:worker_threads';
import { initDatabaseConnection, closeDatabaseConnection } from "../SharedServices/v2Database/services/manageDb.js";
import { setupPool, pool } from "../SharedServices/v2Core/engine/setupPool.js";
import { log } from "../SharedServices/v2Core/core/helperFunctions.js";
import { initToolIndex } from "../SharedServices/v2Database/services/toolIndexing.js";
import { initGuideIndex } from "../SharedServices/v2Database/services/guideIndexing.js";
import { addNewTimer, stopAndClearAllTimers } from "../SharedServices/v2Core/services/timers.js";
import { JOBS } from "../SharedServices/v2Agents/engine/jobManager.js";

let servicesStarted = false;

// Thread overide is used to allow initialization of services in worker threads.
export const initServices = async (threadOveride = false) => {
  if(threadOveride == true){
    log("Initialising services in worker thread...");
  } else {
    log("Initialising services in main thread...");
  }
  if (!isMainThread && !threadOveride) return;

  // only call once
  if (!servicesStarted) {
    log("Setting up services and connections...");
    if(threadOveride) initRegistry(); // init registery in thread.

    // init Surreal DB agent
    let dbTools = await initDatabaseConnection(false);
    if (dbTools.isErr()) {
      log(`Error (initServices -> initDatabaseConnection ) : ${dbTools.value}`);
      process.exit(1);
    }
    // Only call if not a worker thread.
    if(!threadOveride) {
      // Setup Worker Pool (if not a worker thread) 
      setupPool(); 
      // Load Tools
      console.log(' \n\n'+ '[][] ---------------------- [][] \n\n');
      log("Loading Tools...");
      let tools = await initToolIndex();
      if(tools.isErr()){
        log(`Error (initServices -> initToolIndex ) : ${tools.value}`);
        process.exit(1);
      }
      log(`${tools.value.tools} Tools loaded. \n`+
        `${tools.value.added} new. \n`+
        `${tools.value.updated} updated \n`+
        `${tools.value.removed} removed.`)

      // Load Guides
      console.log(' \n\n'+ '[][] ---------------------- [][] \n\n');
      log("Loading Guides...");
      let guides = await initGuideIndex();
      if(guides.isErr()){
        log(`Error (initServices -> initGuideIndex ) : ${guides.value}`);
        process.exit(1);
      }
      log(`${guides.value.guides} Guides loaded. \n`+
        `${guides.value.added} new. \n`+
        `${guides.value.updated} updated \n`+
        `${guides.value.removed} removed.`)

      //Knowledgebase re-indexing timer (every 60 seconds)
      addNewTimer(
        'KB_Indexing_Timer',
        async () => {
            console.log("Running KB Indexing...");
            await pool.run({}, {name: 'poolIndexKnowledgebase'}) // handles it's own 'is already active'
        },
        { delay: 0, intervalMs: 60000, isOneOff : false }
      );

      //New Job Scheduler (every 5 seconds)
      addNewTimer("New_Job_Scheduler", async () => {
          // Only call if not already busy
          if (JOBS.isAllocatorActive() == false) {
              await JOBS.checkNonAllocated();
          }
      }, { delay: 0, intervalMs: 5000, isOneOff : false });

      // Prune completed jobs every 10 mins
      addNewTimer("Prune_Completed_Jobs", async () => {
        await JOBS.jobListManager({ prune: true });
      }, { delay: 0, intervalMs: 600000, isOneOff : false });

      // Write logs to file every 2 mins
      // addNewTimer("Write_Logs_To_File", async () => {
      //   await writeLogsToFile();
      // }, { delay: 0, intervalMs: 120000, isOneOff : false });
    }
    servicesStarted = true;
  }
};

export async function shutdownServices(){
  // Clear all active timers
  stopAndClearAllTimers();
  // Print logs to file
  //await writeLogsToFile(); <-- *********************** TODO 
  // Terminate the Piscina worker pool gracefully
  if (pool) { await pool.destroy();}
  // Close database connection
  await closeDatabaseConnection();
  log('Graceful shutdown complete. Exiting process.');

}