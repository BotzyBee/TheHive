import axios from 'axios';
import { FrontendMessageFormat } from '../classes.js';

/**
 * Calls the task API endpoint with the provided parameters.
 * @param {Array} messages - Array of messages (must conform to the base message format)
 * @param {string} jobId - Id of the job (only needed for follow up messages, can be null for initial prompt) 
 * @param {Object} settings - API settings object. See aiCall in backend for details. 
 * @returns {Promise} - A promise resolving to the API response or an error object.Returns a FrontendMessageFormat object on success.
 */
export async function callTaskApi(messages = [], jobId = null, settings = {}) {
const domain = import.meta.env.VITE_BACKEND_DOMAIN || 'http://localhost:3000';
let url = `${domain}/taskAgent`;
if(settings?.agent == "Quick Agent"){
  url = `${domain}/quickAsk`;
} else {
  url = `${domain}/taskAgent`;
} 

  // Constructing the payload based on your FrontendMessageFormat class
  const payload = new FrontendMessageFormat({
    aiJobId: jobId,
    aiSettings: settings,
    messages: messages 
  });
  try {
    // Make the call
    const response = await axios.post(url, { fmf: { ...payload } });
    return response.data;
  } catch (error) {
    console.error("API Error:", error.response?.data || error.message);
    return error.response
      ? `Server Error: ${error.response.status} - ${error.response.data.error}`
      : `Request Error: ${error.message || 'Unknown error'} - Check if docker server is running.`;
  }
}

/**
 * Calls the task API endpoint with the provided parameters.
 * @param {Array} messages - Array of messages (must conform to the base message format)
 * @param {string} jobId - Id of the job (only needed for follow up messages, can be null for initial prompt) 
 * @param {Object} settings - API settings object. See aiCall in backend for details. 
 * @returns {Promise} - A promise resolving to the API response or an error object.Returns a FrontendMessageFormat object on success.
 */
export async function callQuickAskApi(messages = [], jobId = null, settings = {}) {
const domain = import.meta.env.VITE_BACKEND_DOMAIN || 'http://localhost:3000';
const url = `${domain}/quickAsk`;

  // Constructing the payload based on your FrontendMessageFormat class
  const payload = new FrontendMessageFormat({
    aiJobId: jobId,
    aiSettings: settings,
    messages: messages 
  });
  try {
    // Make the call
    const response = await axios.post(url, { fmf: { ...payload } });
    return response.data;
  } catch (error) {
    return error.response
      ? `Server Error: ${error.response.status} - ${error.response.data.error}`
      : `Request Error: ${error.message || 'Unknown error'} - Check if docker server is running.`;
  }
}

/**
 * Retrieves updates for a specific job.
 * @param {string} jobId - Id of the job to get updates for 
 * @returns {Promise} - A promise resolving to the API response or an error object. Returns a FrontendMessageFormat object on success.
 */
export async function getUpdateApi(jobId) {
  const domain = import.meta.env.VITE_BACKEND_DOMAIN || 'http://localhost:3000';
  const url = `${domain}/getUpdate`;
  try {
    const response = await axios.get(url, {
          params: { jobID: jobId }
        });
    return response.data;
  } catch (error) {
    return error.response
      ? `Server Error: ${error.response.status} - ${error.response.data.error}`
      : `Request Error: ${error.message || 'Unknown error'} - Check if docker server is running.`;
    }
  }

  /**
   * 
   * @param {string} jobId - Id of the job to stop 
   * @returns - A promise resolving to the API response or an error object. Returns a FrontendMessageFormat object on success.
   */
export async function stopJobApi(jobId) {
  const domain = import.meta.env.VITE_BACKEND_DOMAIN || 'http://localhost:3000';
  const url = `${domain}/stopJob`;
  try {
    const response = await axios.get(url, {
          params: { jobID: jobId }
        });
    return response.data;
  } catch (error) {
    return error.response
      ? `Server Error: ${error.response.status} - ${error.response.data.error}`
      : `Request Error: ${error.message || 'Unknown error'} - Check if docker server is running.`;
    }
}