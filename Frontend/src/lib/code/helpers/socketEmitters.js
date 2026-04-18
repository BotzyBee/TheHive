// $lib/code/aiJobs/socketEmitters.js
import { sockets } from '../Stores/socketStore.js';
import { FrontendMessageFormat } from '../classes.js';

/**
 * Emits a prompt to the backend and waits for an acknowledgment containing the Job ID.
 */
export async function emitTask(messages = [], jobId = null, settings = {}) {
    const socket = sockets['/'];
    socket.connect();
    if (!socket) {
        throw new Error("Socket is not connected.");
    }

    const payload = new FrontendMessageFormat({
        aiJobId: jobId,
        aiSettings: settings,
        messages: messages 
    });

    const eventName = settings?.agent === "Quick_Ask_Agent" ? 'submit_quick_ask' : 'submit_task';

    // Wrap the socket emit in a Promise so we can await the backend's acknowledgment
    return new Promise((resolve, reject) => {
        socket.send(eventName, { fmf: { ...payload } }, (response) => {
            if (response?.error) {
                reject(new Error(response.error));
            } else if (response?.aiJobId) {
                resolve(response); // Expected to contain { aiJobId: '...' }
            } else {
                reject(new Error("Invalid response from server. No Job ID provided."));
            }
        });
    });
}

// Sends an array of strings & returns { outcome: 'Ok' | 'Error' value: string }
export async function emitDirectToModel(messages = [], aiSettings, webGrounding) {
    const socket = sockets['/'];
    socket.connect();
    if (!socket) {
        throw new Error("Socket is not connected.");
    }
    const eventName = "direct_to_model";
    // Wrap the socket emit in a Promise so we can await the backend's acknowledgment
    socket.send(eventName, { query: messages, aiSettings, webGrounding }, null);
}


/**
 * Emits a stop command to the backend.
 */
export function emitStopTask(jobId) {
    const socket = sockets['/'];
    socket.connect();
    if (!socket) return;

    // Use an acknowledgment to confirm it was cancelled successfully
    return new Promise((resolve, reject) => {
        socket.send('stop_task', { jobID: jobId }, (response) => {
            if (response?.error) reject(new Error(response.error));
            else resolve(response);
        });
    });
}

/**
 * Emits an amendment or authorisation to the backend
 */
export function emitAmendTask(prompt, jobId) {
    const socket = sockets['/'];
    socket.connect();
    if (!socket) return;

    return new Promise((resolve, reject) => {
        socket.send('amend_task', { amend: { prompt, jobID: jobId } }, (response) => {
            if (response?.error) reject(new Error(response.error));
            else resolve(response);
        });
    });
}