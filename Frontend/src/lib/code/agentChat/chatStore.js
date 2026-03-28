// $lib/code/aiJobs/chatStore.js
import { writable, get } from 'svelte/store';
import { parseAndSanitizeMarkdown } from '../utils.js';
import { callTaskApi, getUpdateApi, stopJobApi, callQuickAskApi } from './call.js';
import { TextMessage, FrontendMessageFormat, Roles } from '../classes.js';
import { processApiMessagesToClasses, parseStatus, getConfig } from '../utils.js';
import { fail } from '@sveltejs/kit';

function createChatStore() {
    const { subscribe, set, update } = writable({
        messageHistory: [],
        isLoading: false,
        jobDone: null,
        stats: { toolCount: 0, aiCount: 0, loopNumber: 0 }, 
        errorMessage: '',
        latestJobRef: null,
        lastStatus: null,
        aiSettings: {
            agent: "Task Agent"
        },
        config: {}
    });

    let intervalRef = null;
    // Fetch initial config on store creation

    async function fetchConfig() {
        let cfgcall = await getConfig();
        update(s => ({
            ...s,
            config: cfgcall
        }));
        return cfgcall;
    }
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
            lastStatus: null,
            messageHistory: [
                ...s.messageHistory,
                new TextMessage({ role: Roles.User, textData: userPrompt })
            ]
        }));

        try {
            // API Call
            let userMsg =  new TextMessage({ role: Roles.User, textData: userPrompt })
            let frontendMessage;
            switch(state.aiSettings.agent){
                case "Task Agent":
                    frontendMessage = await callTaskApi([userMsg], state.latestJobRef, state.aiSettings);
                    break;
                case "Quick-Ask Agent":
                    frontendMessage = await callQuickAskApi([userMsg], state.latestJobRef, state.aiSettings);
                    break;
                default:
                    frontendMessage = await callTaskApi([userMsg], state.latestJobRef, state.aiSettings);
            }
            let jobID = frontendMessage.aiJobId || null;
            // call not ok
            if(!jobID){
                // return error message 
                update(s => ({
                    ...s,
                    isLoading: false,
                    errorMessage: frontendMessage,
                })); 
                return;
            }
            // call ok 
            let messages = processApiMessagesToClasses(frontendMessage.messages);
            // parse markdown in text messages and sanitize all text messages.
            let processedMessages = [];
            for(let i=0; i<messages.length; i++){
                let msg = messages[i];
                if(msg.type === 'text'){
                    msg.textData = parseAndSanitizeMarkdown(msg.textData);
                }
                processedMessages.push(msg);
            }
            // add new messages and update job ref
            update(s => ({
                ...s,
                latestJobRef: frontendMessage.aiJobId,
                messageHistory: [
                    ...s.messageHistory,
                    ...processedMessages
                ]
            }));

            // Poll for updates (check completete or failed status)
            startPolling(frontendMessage.aiJobId);

        } catch (error) {
            const eMsg = `Call has thrown an error: ${error.message || 'Unknown error'}`;
            update(s => ({
                ...s,
                isLoading: false,
                errorMessage: eMsg
            }));
        }
    }

    function startPolling(jobRef) {
        if (intervalRef) clearInterval(intervalRef);

        intervalRef = setInterval(async () => {
            try {
                const updateResult = await getUpdateApi(jobRef);
                const { isRunning, status, messages, metadata } = updateResult;
                // If job is no longer running, stop polling and process final messages
                if(isRunning === false && messages && messages.length > 0){
                    stopPolling();
                    let processedMessages = processApiMessagesToClasses(messages);
                    // Sanitize and parse markdown in text messages.
                    let sanitisedMessages = [];
                    for(let i=0; i<processedMessages.length; i++){
                        let msg = processedMessages[i];
                        if(msg.type === 'text'){
                            msg.textData = parseAndSanitizeMarkdown(msg.textData);
                        }
                        if(msg.type === 'image'){
                            // If the message contains base64 data and a mime type, 
                            // convert it to a data URL for display (if not already in that format)
                            if(msg.base64 && msg.mime){
                                if(!msg.mime.startsWith('data:')){  
                                msg.base64 = `data:${msg.mime};base64,${msg.base64}`;
                                }
                            }
                        }
                        sanitisedMessages.push(msg);
                    }

                    update(s => ({
                        ...s,
                        isLoading: false,
                        jobDone: true,
                        stats: { 
                            toolCount: metadata.toolCount || s.stats.toolCount, 
                            aiCount: metadata.aiCount || s.stats.aiCount, 
                            loopNumber: metadata.loopNumber || s.stats.loopNumber 
                        },
                        messageHistory: [
                            ...s.messageHistory,
                            ...sanitisedMessages
                        ]
                    }));
                } else {
                    // Job is still running, provide an updated status if available.
                    let parsedStatus = parseStatus(status);
                    update(s => ({
                        ...s,
                        lastStatus: parsedStatus || s.lastStatus 
                    }));
                }
            } catch (err) {
                stopPolling();
                update(s => ({ ...s, 
                    isLoading: false, 
                    errorMessage: 'Polling failed - ' + (err.message || 'Unknown error'),
                }));
            }
        }, 1500);
    }

    function stopPolling() {
        if (intervalRef) clearInterval(intervalRef);
        intervalRef = null;
    }

    function reset() {
        const state = get({ subscribe }); // Get current state without subscribing
        stopPolling();
        set({
            messageHistory: [],
            isLoading: false,
            jobDone: null,
            stats: { toolCount: 0, aiCount: 0, loopNumber: 0 },
            errorMessage: '',
            latestJobRef: null,
            lastStatus: null,
            aiSettings: {
                agent: state.aiSettings.agent || "Task Agent"
            },
            config: {}
        });
    }

    async function cancelTask() {
        const state = get({ subscribe });
        if (state.latestJobRef) {
            stopPolling();
            try {
                let res =await stopJobApi(state.latestJobRef);
                let messages = processApiMessagesToClasses(res.messages);
                update(s => ({
                    ...s,
                    isLoading: false,
                    jobDone: true,
                    messageHistory: [
                        ...s.messageHistory,
                        ...messages
                    ]
                }));
            } catch (error) {
            let msg = `Failed to cancel task. Error: ${error.message || 'Unknown error'}`;
            update(s => ({
                ...s,
                isLoading: false,
                jobDone: true,
                errorMessage: msg,
                messageHistory: [
                    ...s.messageHistory,
                    new TextMessage({ role: Roles.Agent, textData: msg })
                ]
            }));
            }
        }
    }

    return {
        subscribe,
        submitPrompt, 
        reset,
        cancelTask,
        fetchConfig,
        updateAISettings: (newSettings) => update(s => ({
            ...s,
            aiSettings: {
                ...s.aiSettings,
                ...newSettings
            }
        }))
    };
}

export const chatStore = createChatStore();