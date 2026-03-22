// $lib/code/aiJobs/chatStore.js
import { writable, get } from 'svelte/store';
import { parseAndSanitizeMarkdown } from '../utils.js';
import { callTaskApi } from './call.js';
import { Services } from '../../../../../Backend/SharedServices/index.js'; // Backend Services
import { processApiMessagesToClasses } from '../../../../../Backend/Engine/routes/index.js';


function createChatStore() {
    const { subscribe, set, update } = writable({
        messageHistory: [],
        isLoading: false,
        jobDone: null,
        stats: { toolCount: 0, aiCount: 0, loopNumber: 0 },
        errorMessage: '',
        latestJobRef: null,
        aiSettings: {}
    });

    let intervalRef = null;

    /**
     * Submits a user prompt for processing
     * @param {object} options
     * @param {string} options.promptText - The user's prompt text to submit. 
     * @returns 
     */
    async function submitPrompt({ promptText } = {}) {
        const userPrompt = promptText.trim();
        const state = get({ subscribe }); // Get current state without subscribing

        if (!userPrompt || state.isLoading || state.jobDone === false) return;

        // Update UI - message submitted
        update(s => ({
            ...s,
            isLoading: true,
            jobDone: false,
            errorMessage: '',
            messageHistory: [
                ...s.messageHistory,
                new Services.Classes.TextMessage({ role: Services.aiMessages.Roles.User, textData: userPrompt })
            ]
        }));

        try {
            // API Call
            /**@type {FrontendMessageFormat} */
            let frontendMessage = await callTaskApi(userPrompt, state.latestJobRef, state.aiSettings);
            let jobID = frontendMessage.aiJobId || null;
            // call not ok
            if(!jobID){
                // return error message 
                update(s => ({
                    ...s,
                    isLoading: false,
                    errorMessage: frontendMessage,
                    messageHistory: [
                        ...s.messageHistory,
                        new Services.Classes.TextMessage({ role: Services.aiMessages.Roles.Agent, textData: frontendMessage })
                    ]
                })); 
            }
            // call ok 
            let messages = processApiMessagesToClasses(frontendMessage.messages);
            if(messages.isErr()){
                let msg = 'Could not process API response messages into frontend classes.';
                update(s => ({
                    ...s,
                    isLoading: false,
                    errorMessage: msg,
                    messageHistory: [
                        ...s.messageHistory,
                        new Services.Classes.TextMessage({ role: Services.aiMessages.Roles.Agent, textData: msg})
                    ]
                })); 
            } 
            // add new messages and update job ref
            update(s => ({
                ...s,
                latestJobRef: frontendMessage.aiJobId,
                messageHistory: [
                    ...s.messageHistory,
                    ...messages.value
                ]
            }));

            // Poll for updates (check completete or failed status)
            startPolling(jobID);

        } catch (error) {
            const eMsg = `Call has thrown an error: ${error.message || 'Unknown error'}`;
            update(s => ({
                ...s,
                isLoading: false,
                errorMessage: eMsg,
                messageHistory: [
                    ...s.messageHistory,
                    new Services.Classes.TextMessage({ role: Services.aiMessages.Roles.Agent, textData: eMsg })
                ]
            }));
        }
    }

    function startPolling(jobRef, aiMsgId) {
        if (intervalRef) clearInterval(intervalRef);

        intervalRef = setInterval(async () => {
            // try {
            //     const updateResult = await checkForUpdate(jobRef);
            //     const { status, data } = updateResult.response;

            //     if (status === 'Complete' || status === 'Failed') {
            //         stopPolling();
            //         update(s => ({ ...s, jobDone: true, isLoading: false }));

            //         if (status === 'Complete' && data.output) {
            //             update(s => ({ ...s, stats: data.stats }));
            //             updateMessage(aiMsgId, data.output);
            //         } else {
            //             updateMessage(aiMsgId, `Job ${jobRef} Failed ☹️`);
            //         }
            //     } else {
            //         // Ongoing status
            //         updateMessage(aiMsgId, `Job ${jobRef} : **${data}**`);
            //     }
            // } catch (err) {
            //     stopPolling();
            //     update(s => ({ ...s, isLoading: false, errorMessage: 'Polling failed.' }));
            // }
        }, 2000);
    }

    function updateMessage(id, text) {
        update(s => ({
            ...s,
            messageHistory: s.messageHistory.map(msg => 
                msg.id === id ? { ...msg, text: parseAndSanitizeMarkdown(text) } : msg
            )
        }));
    }

    function stopPolling() {
        if (intervalRef) clearInterval(intervalRef);
        intervalRef = null;
    }

    function reset() {
        stopPolling();
        set({
            messageHistory: [],
            isLoading: false,
            jobDone: null,
            stats: { toolCount: 0, aiCount: 0, loopNumber: 0 },
            errorMessage: '',
            latestJobRef: null,
        });
    }

    async function cancelTask() {
        const state = get({ subscribe });
        if (state.latestJobRef) {
            await stopTask(state.latestJobRef);
            stopPolling();
            update(s => ({ ...s, jobDone: true, isLoading: false }));
        }
    }

    return {
        subscribe,
        submitPrompt,
        reset,
        cancelTask
    };
}

export const chatStore = createChatStore();