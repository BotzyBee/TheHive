import { Agents } from './Agents/index.js';
import { AiCall } from './CallAI/index.js';
import { CoreTools } from './CoreTools/index.js';
import { Database } from './Database/index.js';
import { SharedUtils } from './Utils/index.js';

class SharedServices {
  // Import the types (for intelisense)
  /** @type {Agents} */
  agents;
  /** @type {CallAI} */
  callAI;
  /** @type {CoreTools} */
  coreTools;
  /** @type {Database} */
  database;
  /** @type {SharedUtils} */
  utils;

  constructor(agents, callAI, coreTools, database, utils) {
    this.agents = agents;
    this.callAI = callAI;
    this.coreTools = coreTools;
    this.database = database;
    this.utils = utils;
  }
}

export let Services = new SharedServices(
  new Agents(),
  new AiCall(),
  new CoreTools(),
  new Database(),
  new SharedUtils()
);
