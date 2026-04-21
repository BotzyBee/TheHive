// $lib/code/aiJobs/chatStore.js
import { writable, get } from 'svelte/store';
import { sockets } from './socketStore.js';
import { emitTask, emitStopTask, emitDirectToModel } from '../helpers/socketEmitters.js';
import { parseAndSanitizeMarkdown, processApiMessagesToClasses, parseStatus, getConfig } from '../utils.js';
import { TextMessage, Roles } from '../classes.js';
import { parse } from 'svelte/compiler';

function createChatStore() {
    const state = {
        messageHistory: [],
        isLoading: false,
        jobDone: null,
        stats: { toolCount: 0, aiCount: 0, loopNumber: 0 }, 
        errorMessage: '',
        latestJobRef: null,
        lastStatus: null,
        aiSettings: {
            agent: "Task_Agent"
        },
        config: {},
        webGrounding: false
    }; 

    const { subscribe, set, update } = writable(state);

    // Watch the socketStore so we can attach listeners as soon as the socket initializes
    sockets['/'].subscribe(socket => {
        if (socket) {
            setupSocketListeners(socket);
        }
    })
    // socketStore.subscribe(socket => {
    //     if (socket) {
    //         setupSocketListeners(socket);
    //     }
    // });

    function setupSocketListeners(socket) {
        // Clear previous listeners to prevent duplicates during hot reloads
        socket.off('job_update');
        socket.off('job_complete');
        socket.off('job_error');
        socket.off('direct_to_model_response');

        // Handle direct to model responses
        socket.on('direct_to_model_response', (data) => {
            if(data.outcome == "Error"){
            update(s => ({
                    ...s,
                    isLoading: false,
                    jobDone: true,
                    errorMessage: data.value,
                    lastStatus: null,
                })); 
            } else {
                let sanitised = parseAndSanitizeMarkdown(data.value);
                let responseMsg = new TextMessage({ role: Roles.Agent, textData: sanitised });
                update(s => ({
                    ...s,
                    isLoading: false,
                    jobDone: true,
                    errorMessage: '',
                    lastStatus: null,
                    messageHistory: [...s.messageHistory, responseMsg]
                }));                
            }
        });

        // Handles interim updates (e.g., streaming status or partial text)
        socket.on('job_update', (data) => {
            const currentStore = get({ subscribe });
            if (data.aiJobId !== currentStore.latestJobRef) return; // Ignore old job updates
            let parsedStatus = parseStatus(data.status);
            let il = true;
            let jd = false;
            if(data.status.taskStatus == "Failed") {
                il = false;
                jd = true;
            }
            update(s => ({
                ...s,
                lastStatus: parsedStatus || s.lastStatus,
                isLoading: il,
                jobDone: jd,
            }));
        });

        // Handles the final payload when a job finishes
        socket.on('job_complete', (data) => {
            const currentStore = get({ subscribe });

            // Ensure this update is for the current job
            if (data.aiJobId != currentStore.latestJobRef) return;

            const { messages, metadata } = data;
            
            let processedMessages = processApiMessagesToClasses(messages || []);
            let sanitisedMessages = [];
            
            for(let i=0; i<processedMessages.length; i++){
                let msg = processedMessages[i];
                if(msg.type === 'text'){
                    msg.textData = parseAndSanitizeMarkdown(msg.textData);
                }
                if(msg.type === 'image' && msg.base64 && msg.mime){
                    if(!msg.mime.startsWith('data:')){  
                        msg.base64 = `data:${msg.mime};base64,${msg.base64}`;
                    }
                }
                sanitisedMessages.push(msg);
            }
            update(s => ({
                ...s,
                isLoading: false,
                jobDone: true,
                stats: { 
                    toolCount: metadata?.toolCount || s.stats.toolCount, 
                    aiCount: metadata?.aiCount || s.stats.aiCount, 
                    loopNumber: metadata?.loopNumber || s.stats.loopNumber 
                },
                messageHistory: [
                    ...s.messageHistory,
                    ...sanitisedMessages
                ]
            }));
        });

        // Handles catastrophic backend errors on a running job
        socket.on('job_error', (data) => {
            const currentStore = get({ subscribe });
            if (data.aiJobId !== currentStore.latestJobRef) return;

            update(s => ({
                ...s,
                isLoading: false,
                errorMessage: `Backend Error: ${data.error || 'Unknown error occurred.'}`
            }));
        });
    }

    async function fetchConfig() {
        let cfgcall = await getConfig();
        update(s => ({
            ...s,
            config: cfgcall
        }));
        return cfgcall;
    }

    async function submitDirectToModel({ promptText } = {}){
        const userPrompt = promptText.trim();
        let userMsg = new TextMessage({ role: Roles.User, textData: userPrompt });
        update(s => ({
            ...s,
            isLoading: true,
            jobDone: false,
            errorMessage: '',
            lastStatus: null,
            messageHistory: [...s.messageHistory, userMsg]
        }));
        const currentState = get({ subscribe });
        // simplify messages
        let msgs = [];
        for(let message of currentState.messageHistory){
            msgs.push(`Role: ${message.role} , Message: ${message.textData}`)
        }
        emitDirectToModel(msgs, currentState.aiSettings, currentState.webGrounding);
    }

    async function submitPrompt({ promptText } = {}) {
        const userPrompt = promptText.trim();
        const currentState = get({ subscribe });

        if (!userPrompt || currentState.isLoading || currentState.jobDone === false) return;

        let userMsg = new TextMessage({ role: Roles.User, textData: userPrompt });

        update(s => ({
            ...s,
            isLoading: true,
            jobDone: false,
            errorMessage: '',
            lastStatus: null,
            messageHistory: [...s.messageHistory, userMsg]
        }));

        try {
            // Emitting instead of HTTP POST. It waits for the ack callback to resolve.
            const response = await emitTask([userMsg], currentState.latestJobRef, currentState.aiSettings);
            update(s => ({
                ...s,
                latestJobRef: response.aiJobId,
                // If the backend returns processed initial messages, add them here
                messageHistory: response.messages ? [
                    ...s.messageHistory,
                    ...processApiMessagesToClasses(response.messages)
                ] : s.messageHistory
            }));

            // Polling is completely gone! We just sit back and let the socket.on() listeners do the work.
            
        } catch (error) {
            update(s => ({
                ...s,
                isLoading: false,
                errorMessage: `Task failed to start: ${error.message || 'Unknown error'}`
            }));
        }
    }

    function reset() {
        const currentState = get({ subscribe });
        set({
            ...state, // Reset to initial blank state defined at top
            aiSettings: {
                agent: currentState.aiSettings.agent || "Task_Agent"
            }
        });
    }

    async function cancelTask() {
        const currentState = get({ subscribe });
        if (currentState.latestJobRef) {
            try {
                const res = await emitStopTask(currentState.latestJobRef);
                let messages = processApiMessagesToClasses(res?.messages || []);
                
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
        })),
        updateWebGrounding: (webGrounding) => update(s => ({
            ...s,
            webGrounding: webGrounding
        })),
        submitDirectToModel
    };
}

export const chatStore = createChatStore();