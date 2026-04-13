import { registry } from "../SharedServices/registry.js";
import * as v2Core from '../SharedServices/v2Core/index.js';
import * as v2AiAgents from '../SharedServices/v2Agents/index.js';
import * as v2CallAI from '../SharedServices/v2CallAI/index.js';
import * as v2Database from '../SharedServices/v2Database/index.js';
import * as v2FileSystem from '../SharedServices/v2FileSystem/index.js';

// Init Classes

// Register Services in the registry
export function initRegistry() {
    console.log("Initialising Service Registry...");
    registry.register('v2Core', v2Core);
    registry.register('aiAgents', v2AiAgents);
    registry.register('callAI', v2CallAI);
    registry.register('database', v2Database);
    registry.register('fileSystem', v2FileSystem);
}




