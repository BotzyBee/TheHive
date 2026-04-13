// import * as Classes from './Classes/index.js';
// import * as AiCall from './CallAI/index.js';
// import * as CoreTools from './CoreTools/index.js';
// import * as Utils from './Utils/index.js';
// import * as FileSystem from './FileSystem/index.js';
// import * as Database from './Database/index.js';
// import * as Constants from './constants.js';
// import * as Agents from './Agents/index.js';

// export const Services = {
//   Classes,
//   AiCall,
//   CoreTools,
//   Constants,
//   Database,
//   FileSystem,
//   Utils,
//   Agents,
// }

import { registry } from './registry.js';

/** @typedef {typeof import('./v2CoreTools/index.js')} CoreTools */
/** @typedef {typeof import('./v2Agents/index.js')} AiAgents */
/** @typedef {typeof import('./v2CallAI/index.js')} CallAI */

/**
 * This object is our "Intellisense Bridge". 
 * We use JSDoc to tell the editor exactly what these services look like
 * without actually importing the heavy Class files at the top.
 */
export const Services = {
  /** @type {CoreTools} */
    get coreTools() { return registry.get('coreTools'); },
  
    /** @type {AiAgents} */
    get aiAgents() { return registry.get('aiAgents'); },

    /** @type {CallAI} */
    get callAI() { return registry.get('callAI'); },
};