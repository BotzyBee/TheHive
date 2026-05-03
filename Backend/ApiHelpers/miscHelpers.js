import { Services } from '../SharedServices/index.js';
import { JOBS } from '../SharedServices/v2Agents/engine/jobManager.js';

export function getConfigForFrontend() {
  let rtnObject = {
    AiProviders: Services.callAI.Constants.AiProviders,
    AiModels: Services.callAI.Constants.MODEL_REGISTRY,
    ModelTypes: Services.callAI.Constants.ModelTypes,
    AiQuality: Services.callAI.Constants.AiQuality,
    Agents: {
      taskAgent: 'Task_Agent',
      quickAsk: 'Quick_Ask_Agent',
    },
  };
  return rtnObject;
}

export function stopJob(jobID) {
  let msg = JOBS.jobListManager({ stopJob: jobID });
  if (msg.isErr()) return { error: msg.value };

  const rtnMsg = new Services.aiAgents.Classes.FrontendMessageFormat({
    aiJobId: jobID,
    status: Services.aiAgents.Classes.Status.Stopped,
    isRunning: false,
    messages: [
      new Services.aiAgents.Classes.TextMessage({
        role: Services.aiAgents.Constants.Roles.Agent,
        textData: `Job ${jobID} has been stopped.`,
      }),
    ],
  });
  return rtnMsg;
}

// Handles add, update and delete actions coming from the frontend.
export async function handleModelUpdates(actionObject) {
  try {
    if (!actionObject || typeof actionObject !== 'object') {
      throw new Error('Invalid actionObject');
    }

    const { action, data } = actionObject;

    if (!action || !data || typeof data !== 'object') {
      throw new Error('actionObject must contain action and data');
    }

    // Replace this with however you obtain your db agent
    const dbAgentCall = await Services.database.ManageDb.getDbAgent();
    if (dbAgentCall.isErr())
      throw new Error(
        `Error (handleModelUpdates -> getDbAgent) : ${dbAgentCall.value}`
      );
    const dbAgent = dbAgentCall.value;
    const modelTableName = Services.database.Constants.modelTableName;

    const mapQualityToNumber = (quality) => {
      let AiQuality = Services.callAI.Constants.AiQuality;
      if (typeof quality === 'number') return quality;
      if (typeof quality === 'string' && AiQuality[quality] !== undefined) {
        return AiQuality[quality];
      }
      throw new Error(`Invalid quality value: ${quality}`);
    };

    const { id, active, model, provider, capabilities, maxContext, quality } =
      data;

    const mappedQuality = mapQualityToNumber(quality);

    switch (action) {
      case 'add': {
        return await Services.database.CRUD.addModelToDB(
          dbAgent,
          active,
          model,
          provider,
          capabilities,
          maxContext,
          mappedQuality
        );
      }

      case 'update': {
        if (!id) {
          throw new Error('id is required for update');
        }
        // Full id looks like: "ModelRegistry:0aci1w6hba7cjd9ndgds"
        const idRef = id.includes(':') ? id.split(':')[1] : id;

        const updateData = {
          active,
          model,
          provider,
          capabilities,
          maxContext,
          quality: mappedQuality,
        };

        return await Services.database.CRUD.updateRecordById(
          dbAgent,
          modelTableName,
          idRef,
          updateData
        );
      }

      case 'delete': {
        if (!id) {
          throw new Error('id is required for delete');
        }

        // Full id looks like: "ModelRegistry:0aci1w6hba7cjd9ndgds"
        const idRef = id.includes(':') ? id.split(':')[1] : id;

        return await Services.database.CRUD.deleteRecordsById(
          dbAgent,
          modelTableName,
          idRef
        );
      }

      default:
        throw new Error(`Unsupported action: ${action}`);
    }
    return Services.v2Core.Helpers.Ok(null);
  } catch (error) {
    return Services.v2Core.Helpers.Err(`Error (handleModelUpdates) : ${error}`);
  }
}
