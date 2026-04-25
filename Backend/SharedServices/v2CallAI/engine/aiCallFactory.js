import { AiCall } from '../core/classes.js';
import { ModelTypes, AiQuality, AiProviders, MODEL_REGISTRY, DEFAULT_PROVIDER } from '../core/constants.js';
import { PROVIDER_DISPATCH } from './dispatcher.js';
import { Services } from '../../index.js';

export async function aiFactory(){
    let availableModels = MODEL_REGISTRY;
    let dbModels = await Services.database.ModelRegistry.getAllActiveModels();
    if(dbModels.isOk())availableModels = dbModels.value;
    let CL = new AiCall({
        models: availableModels,
        quality: AiQuality,
        providers: AiProviders,
        capabilities: ModelTypes,
        functions: PROVIDER_DISPATCH,
        defaultProvider: DEFAULT_PROVIDER
    });
    return CL;
}