import { registry } from './registry.js';

/** @typedef {typeof import('./v2Core/index.js')} Core */
/** @typedef {typeof import('./v2Agents/index.js')} AiAgents */
/** @typedef {typeof import('./v2CallAI/index.js')} CallAI */
/** @typedef {typeof import('./v2Database/index.js')} Database */
/** @typedef {typeof import('./v2FileSystem/index.js')} FileSystem */

/**
 * This is the main shared services object - acting as a bridge between services. 
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