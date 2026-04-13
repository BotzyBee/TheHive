import { AiCall } from '../core/classes.js';
import { ModelTypes, AiQuality, AiProviders, MODEL_REGISTRY, DEFAULT_PROVIDER } from '../core/constants.js';
import { PROVIDER_DISPATCH } from './dispatcher.js';

export function aiFactory(){
    return new AiCall(
        MODEL_REGISTRY,
        AiQuality,
        AiProviders,
        ModelTypes,
        PROVIDER_DISPATCH,
        DEFAULT_PROVIDER
    );
}