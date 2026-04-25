
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { TextMessage, ImageMessage, AudioMessage, DataMessage } from './classes.js';
import axios from 'axios';

/**
 * Helper function to parse Markdown and then sanitize the HTML
 * @param {string} markdownText 
 * @returns {string} The sanitized HTML generated from the Markdown input
 */
export function parseAndSanitizeMarkdown(markdownText) {
    const rawHtml = marked.parse(markdownText);
    const sanitizedHtml = DOMPurify.sanitize(rawHtml);
    return sanitizedHtml;
}

export function processApiMessagesToClasses(messageArray) {
    if (!Array.isArray(messageArray)) {
    return [];
    }
    const outputArray = messageArray.map((msg) => {
    switch (msg.type) {
        case 'text':
        return new TextMessage(msg);
        case 'image':
        return new ImageMessage(msg);
        case 'audio':
        return new AudioMessage(msg);
        case 'data':
        return new DataMessage(msg);
        default:
        return [];
    }
    });
    return outputArray;
}

export function generateShortID(prefix) {
  if (!prefix) prefix = 'Action';
  return `${prefix}_****`.replace(/[*y]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c == '*' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function parseStatus(status){
  if(status.taskStatus === "Custom Status"){
    return status.customText;
  } else {
    return status.taskStatus;
  }
}

/**
 * Retrieves the available models, agents, and other configuration settings from the backend API.
 * @returns {Promise} - A promise resolving to the API response or an error object. Returns a FrontendMessageFormat object on success.
 */
export async function getConfig() {
  const domain = import.meta.env.VITE_BACKEND_DOMAIN || 'http://localhost:3000';
  const url = `${domain}/getConfig`;
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    return error.response
      ? `Server Error: ${error.response.status} - ${error.response.data.error}`
      : `Request Error: ${error.message || 'Unknown error'} - Check if docker server is running.`;
  }
}

/**
 * Retrieves full details of the available models. 
 * @returns {Promise} - A promise resolving to the API response or an error object.
 *  Output example:
    {
    openAI: [
        {
        model: 'gpt-5-nano',
        provider: 'OpenAI',
        capabilities: ['text', 'structuredOutputs', 'websearch'],
        maxContext: 400000,
        quality: 'Base',
        active: true
        },
        // More models...
    ],
    gemini: [
        // Models...
    ],
    // Other providers...
    }
 */
export async function getModels() {
  const domain = import.meta.env.VITE_BACKEND_DOMAIN || 'http://localhost:3000';
  const url = `${domain}/getModels`;
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    return error.response
      ? `Server Error: ${error.response.status} - ${error.response.data.error}`
      : `Request Error: ${error.message || 'Unknown error'} - Check if docker server is running.`;
    }
  }

  export async function updateModels(updateData) {
  const domain = import.meta.env.VITE_BACKEND_DOMAIN || 'http://localhost:3000';
  const url = `${domain}/updateModels`;
  try {
    const response = await axios.post(url, updateData);
    return response.data;
  } catch (error) {
    return error.response
      ? `Server Error: ${error.response.status} - ${error.response.data.error}`
      : `Request Error: ${error.message || 'Unknown error'} - Check if docker server is running.`;
    }
  }