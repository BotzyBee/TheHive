import { registry } from "../SharedServices/registry.js";
import * as v2CoreTools from '../SharedServices/v2CoreTools/index.js';
import * as v2AiAgents from '../SharedServices/v2Agents/index.js';
import * as v2CallAI from '../SharedServices/v2CallAI/index.js';


// Init Classes

// Register Services in the registry
export function initRegistry() {
    registry.register('coreTools', v2CoreTools);
    registry.register('aiAgents', v2AiAgents);
    registry.register('callAI', v2CallAI);
}




