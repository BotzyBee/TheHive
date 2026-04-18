
SERVICE FILES
If a file provides a "service" (database, logger, config), it should be a standalone module. Don't attach it to a global "app" object.


Layer   	            Content     	                                    Rule
1. Constants	        Env vars, hardcoded strings, TS interfaces.	      Can be imported by anything. Imports nothing.
2. Utils        	    Pure functions (math, string formatting).	        Can be imported by Layers 3-5. Imports only Layer 1.
3. Service	          Database CRUD, API wrappers, Base Classes.	      Can be imported by Layers 4-5. Imports Layers 1-2.
4. Engine       	    Job managers, Agents, Business logic.	            Can be imported by Layer 5. Imports Layers 1-3.
5. API                app.js, Cron jobs.	                              Imports anything. Imported by nothing.


// [][] ------------------------------ [][]
// SharedServices/registry.js -- A bridge between the modules.

class ServiceRegistry {
  constructor() {
    this.services = new Map();
  }

  /**
   * Register a service instance.
   * @param {string} name 
   * @param {object} instance 
   */
  register(name, instance) {
    if (this.services.has(name)) {
      console.warn(`Service "${name}" is being overwritten.`);
    }
    this.services.set(name, instance);
  }

  /**
   * Retrieve a service. Throws error if not found.
   */
  get(name) {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`ServiceRegistry Error: "${name}" has not been registered yet.`);
    }
    return service;
  }
}

// Export a singleton instance
export const registry = new ServiceRegistry();


// [][] ------------------------------ [][]

// initRegistry.js (called by app.js)
import { registry } from './SharedServices/registry.js';
import { Database } from './SharedServices/Database/CRUD.js';
import { JobManager } from './Engine/jobManager.js';

// 1. Initialize the actual "heavy" logic
const db = new Database(process.env.DB_URL);
const jobs = new JobManager();

// 2. Register them
registry.register('db', db);
registry.register('jobs', jobs);

// SharedServices/services.js
import { registry } from './registry.js';


/**
 * This object is our "Intellisense Bridge". 
 * We use JSDoc to tell the editor exactly what these services look like
 * without actually importing the heavy Class files at the top.
 */
export const services = {
    /** @type {import('./Database/CRUD').Database} */
    get db() { return registry.get('db'); },

    /** @type {import('../Engine/jobManager').JobManager} */
    get jobs() { return registry.get('jobs'); },

    /** @type {import('./Agents/agentUtils').AgentUtils} */
    get utils() { return registry.get('utils'); }
};


// [][] ------------------------------ [][]
// USE IT. 

// SharedServices/Agents/TaskAgent/index.js
import { registry } from '../../registry.js';

export class TaskAgent {
  async runTask(data) {
    // We don't import JobManager at the top. 
    // We look it up when we actually need it.
    const jobManager = registry.get('jobs'); 
    const db = registry.get('db');

    await db.saveTask(data);
    jobManager.queue(data);
  }
}


// [][] --------- CLASSES ---------- [][]

The "Safe" Approach: Instead of a class being something (Inheritance), have a class use something (Composition).
Bad (Inheritance): class TaskManager extends Database
Good (Composition): class TaskManager { constructor(db) { this.db = db; } }

If you must have a base class - then aim to have zero imports from other parts of the app. If it needs utilities, pass them in as arguments or get them from the registry inside a method, not at the top of the file


// [][] ---- COME BACK TO ---- [][]
setup2.js