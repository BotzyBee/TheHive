import { AiCall } from '../core/classes.js';
import { ModelTypes, AiQuality, AiProviders, MODEL_REGISTRY, DEFAULT_PROVIDER } from '../core/constants.js';
import { PROVIDER_DISPATCH } from './dispatcher.js';

export function aiFactory(){
    let CL = new AiCall({
        models: MODEL_REGISTRY,
        quality: AiQuality,
        providers: AiProviders,
        capabilities: ModelTypes,
        functions: PROVIDER_DISPATCH,
        defaultProvider: DEFAULT_PROVIDER
    });
    return CL;
}