// $lib/code/aiJobs/socketEmitters.js
import { get } from 'svelte/store';
import { socketStore } from '../agentChat/socketStore.js';
import { FrontendMessageFormat } from '../classes.js';

/**
 * Emits a prompt to the backend and waits for an acknowledgment containing the Job ID.
 */
export async function emitTask(messages = [], jobId = null, settings = {}) {
    const socket = get(socketStore);
    if (!socket || !socket.connected) {
        throw new Error("Socket is not connected.");
    }

    const payload = new FrontendMessageFormat({
        aiJobId: jobId,
        aiSettings: settings,
        messages: messages 
    });

    const eventName = settings?.agent === "Quick Agent" ? 'submit_quick_ask' : 'submit_task';

    // Wrap the socket emit in a Promise so we can await the backend's acknowledgment
    return new Promise((resolve, reject) => {
        socket.emit(eventName, { fmf: { ...payload } }, (response) => {
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

/**
 * Emits a stop command to the backend.
 */
export function emitStopTask(jobId) {
    const socket = get(socketStore);
    if (!socket || !socket.connected) return;

    // Use an acknowledgment to confirm it was cancelled successfully
    return new Promise((resolve, reject) => {
        socket.emit('stop_task', { jobID: jobId }, (response) => {
            if (response?.error) reject(new Error(response.error));
            else resolve(response);
        });
    });
}

/**
 * Emits an amendment or authorisation to the backend
 */
export function emitAmendTask(prompt, jobId) {
    const socket = get(socketStore);
    if (!socket || !socket.connected) return;

    return new Promise((resolve, reject) => {
        socket.emit('amend_task', { amend: { prompt, jobID: jobId } }, (response) => {
            if (response?.error) reject(new Error(response.error));
            else resolve(response);
        });
    });
}