import { RustAgentMessage, RustMessageOutcome, RustMessageType } from './types.js';
import { Ok, Err } from '../../Utils/helperFunctions.js';

const callTimeout = 30000; // 30 seconds

/**
 * Sends a message to Rust to start the web agent with the specified URL and job ID.
 * @param {String} webUrl - The URL that the web agent should navigate to 
 * @param {Object} socket - The socket.io instance to communicate with Rust
 * @param {String} jobID - A unique identifier for the job, used for tracking and logging
 * Returns void, but emits a 'start-web-agent' event to Rust with the necessary information to start the web agent. 
 */
export async function initWebDriver(socket, webUrl, jobID) {
    return new Promise((resolve) => {
        // Set a safety timeout
        const timeout = setTimeout(() => {
            socket.off('start-agent-response', handleResponse);
            resolve(Err(`WebDriver initialisation timed out for jobID: ${jobID}`));
        }, callTimeout);

        // Response Listener
        const handleResponse = (data) => {
            console.log("Received response for initWebDriver:", data);
            if (data.job_id === jobID) {
                clearTimeout(timeout);
                socket.off('start-agent-response', handleResponse);

                if (data.outcome === RustMessageOutcome.Success) {
                    resolve(Ok(data));
                } else {
                    resolve(Err(`Error (initWebDriver) : ${data.data}`));
                }
            } else {
                console.warn(`Received response for job_id ${data.job_id}, but expected ${jobID}. Ignoring this response.`);
            }
        };

        // Start listening
        socket.on('start-agent-response', handleResponse);

        // Send the trigger
        try {
            const message = new RustAgentMessage(
                jobID,
                webUrl,
                RustMessageType.Request,
                {}
            );
            socket.emit('start-web-agent', message);
        } catch (e) {
            clearTimeout(timeout);
            socket.off('start-agent-response', handleResponse);
            resolve(Err(`Failed to emit socket message: ${e.message}`));
        }
    });
}

/**
 * Wraps a socket emit and its corresponding async response into a Promise.
 * @param {Object} socket - The socket.io instance
 * @param {String} jobID - A unique ID to track this specific request
 * @returns {Promise<Result>} - Result <string>
 */
export async function getCurrentPageContent(socket, jobID) {
    return new Promise((resolve) => {
        // Set a safety timeout
        const timeout = setTimeout(() => {
            socket.off('page-content-response', handleResponse);
            resolve(Err(`Request timed out for jobID: ${jobID}`));
        }, callTimeout);

        // Ltener
        const handleResponse = (data) => {
            if (data.job_id === jobID) {
                clearTimeout(timeout);
                socket.off('page-content-response', handleResponse);

                if(data.outcome === RustMessageOutcome.Success){
                    resolve(Ok(data)); 
                } else {
                    resolve(Err(`Error (getCurrentPageContent) : ${data.data}`));
                }
            }
        };

        // Start listening
        socket.on('page-content-response', handleResponse);

        // 4. Send the trigger
        try {
            const message = new RustAgentMessage(
                jobID,
                "url-not-needed-for-this-request",
                RustMessageType.Request,
                {}
            );
            
            socket.emit('capture-dom', message);
        } catch (e) {
            clearTimeout(timeout);
            socket.off('page-content-response', handleResponse);
            resolve(Err(`Failed to emit socket message: ${e.message}`));
        }
    });
}