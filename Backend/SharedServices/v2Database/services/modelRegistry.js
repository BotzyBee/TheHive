import { Services } from '../../index.js';
import { getRecords, addModelToDB, getAllRecordsFromTable } from './CRUD.js';
import { getDbAgent } from './manageDb.js';
import { modelTableName } from '../core/constants.js';


/**
 * Initialises the model registry by loading predefined models and ensuring their presence in the database.
 * If a model from MODEL_REGISTRY does not exist in the database, it will be added with 'active' set to true.
 * This function is intended to run on server start.
 *
 * @returns {Promise<Result>} A result object indicating success or failure of the initialisation.
 */
export async function initModelRegistry() {
  console.log('--- Initialising Model Registry ---');
  const dbAgentCall = await getDbAgent();
  if(dbAgentCall.isErr()){
     return Services.v2Core.Helpers.Err(`Error (initRegistry -> getDbAgent) : ${dbAgentCall.value}`);
  }
  const dbAgent = dbAgentCall.value;

  const MODEL_REGISTRY = Services.callAI.Constants.MODEL_REGISTRY;
  try {
    for (const modelConfig of MODEL_REGISTRY) {
      const { model, provider, capabilities, maxContext, quality } = modelConfig;

      // Check if the model already exists in the database by its 'model' identifier
      const existingModelResult = await getRecords(dbAgent, modelTableName, 'model', model);
      if(existingModelResult.isErr()){
        return Services.v2Core.Helpers.Err(`Error (initRegistry -> getRecords) : ${existingModelResult.value}`);
      }
      // Assuming getRecords returns an array of results in result.data[0]
      const existingModels = existingModelResult.value[0] || [];
        if (existingModels.length === 0) {
          // Model does not exist, add it to the database
          console.log(`Model '${model}' not found in DB. Adding it now...`);
          const addResult = await addModelToDB(
            dbAgent,
            true, // Set active to true for newly added models
            model,
            provider,
            capabilities,
            maxContext,
            quality
          );
          if(addResult.isErr()){
            return Services.v2Core.Helpers.Err(`Error (initRegistry -> addModelToDB) : ${addResult.value}`);
          }
        } else {
          console.log(`Model '${model}' already exists in the registry.`);
        }
    }
    console.log('--- Model Registry Initialisation Complete --- \n \n');
    return Services.v2Core.Helpers.Ok('Registry initialised successfully.');
  } catch (error) {
    console.error(`Error during registry initialisation: ${error.message || error}`);
    return Services.v2Core.Helpers.Err(`Error (initRegistry) failed during registry initialisation: ${error.message || error}`);
  }
}

/**
 * Retrieves all active models from the database.
 * This function filters the model registry database table to only return models with 'active: true'.
 *
 * @returns {Promise<Result>} A result object containing an array of active models or an error.
 */
export async function getAllActiveModels() {
  try {
    const dbAgentCall = await getDbAgent();
    if(dbAgentCall.isErr()){
      return Services.v2Core.Helpers.Err(`Error (getAllActiveModels -> getDbAgent) : ${dbAgentCall.value}`);
    }
    const dbAgent = dbAgentCall.value;
    console.log('Fetching all active models from the registry...');
    // Use getRecords to filter by the 'active' field set to true
    const result = await getRecords(dbAgent, modelTableName, 'active', true);
    if(result.isErr()){
      return Services.v2Core.Helpers.Err(`Error (getAllActiveModels) : ${result.value}`);
    }
    const activeModels = result.value[0];
    return Services.v2Core.Helpers.Ok(activeModels);
  } catch (error) {
    console.error(`Error in getAllActiveModels: ${error.message || error}`);
    return Services.v2Core.Helpers.Err(`Error in getAllActiveModels: ${error.message || error}`);
  }
}

/**
 * Get all models - active or inactive from the DB
 * @returns {Promise<Result>} A result object containing an array of models
 */
export async function getAllModels() {
  try {
    const dbAgentCall = await getDbAgent();
    if(dbAgentCall.isErr()){
      return Services.v2Core.Helpers.Err(`Error (getAllModels -> getDbAgent) : ${dbAgentCall.value}`);
    }
    const dbAgent = dbAgentCall.value;
    console.log('Fetching all active models from the registry...');
    // Use getRecords to filter by the 'active' field set to true
    const result = await getAllRecordsFromTable(dbAgent, modelTableName);
    if(result.isErr()){
      return Services.v2Core.Helpers.Err(`Error (getAllModels) : ${result.value}`);
    }
    const allModels = result.value;
    return Services.v2Core.Helpers.Ok(allModels);
  } catch (error) {
    console.error(`Error in getAllModels: ${error.message || error}`);
    return Services.v2Core.Helpers.Err(`Error in getAllModels: ${error.message || error}`);
  }
}