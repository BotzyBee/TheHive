import { Services } from "../../../../../Backend/SharedServices/index.js";

/**
 * Calls the task API endpoint with the provided parameters.
 * @param {Array} messages - Array of messages (must conform to the base message format)
 * @param {string} jobId - Id of the job (only needed for follow up messages, can be null for initial prompt) 
 * @param {Object} settings - API settings object. See aiCall in backend for details. 
 * @returns {Promise} - A promise resolving to the API response or an error object
 */
export async function callTaskApi(messages = [], jobId = null, settings = {}) {
const domain = import.meta.env.VITE_BACKEND_DOMAIN || 'http://localhost:3000';
const url = `${domain}/taskAgent`;

  // Constructing the payload based on your FrontendMessageFormat class
  const payload = Services.Classes.FrontendMessageFormat({
    aiJobId: jobId,
    aiSettings: settings,
    messages: messages 
  });

  try {
    // Make the call
    const response = await axios.post(url, payload);
    return response.data;

  } catch (error) {
    return error.response
      ? { error: `Server Error: ${error.response.status} - ${error.response.data.error}` }
      : { error: `Request Error: ${error.message || 'Unknown error'}` };
  }
}
