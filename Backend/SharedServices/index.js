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

/** @typedef {typeof import('./v2Core/index.js')} Core */
/** @typedef {typeof import('./v2Agents/index.js')} AiAgents */
/** @typedef {typeof import('./v2CallAI/index.js')} CallAI */
/** @typedef {typeof import('./v2Database/index.js')} Database */
/** @typedef {typeof import('./v2FileSystem/index.js')} FileSystem */

/**
 * This object is our "Intellisense Bridge". 
 * We use JSDoc to tell the editor exactly what these services look like
 * without actually importing the heavy Class files at the top.
 */
export const Services = {
  /** @type {Core} */
    get v2Core() { return registry.get('v2Core'); },
  
    /** @type {AiAgents} */
    get aiAgents() { return registry.get('aiAgents'); },

    /** @type {CallAI} */
    get callAI() { return registry.get('callAI'); },

    /** @type {Database} */
    get database() { return registry.get('database'); },

    /** @type {FileSystem} */
    get fileSystem() { return registry.get('fileSystem'); },
};