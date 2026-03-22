// $lib/code/aiJobs/chatStore.js
import { writable, get } from 'svelte/store';
import { callTaskApi, checkForUpdate, postAmendApi, stopTask } from './call.js';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

function createChatStore() {
    const { subscribe, set, update } = writable({
        messageHistory: [],
        isLoading: false,
        jobDone: null,
        stats: { toolCount: 0, aiCount: 0, loopNumber: 0 },
        errorMessage: '',
        latestJobRef: null,
        isInitPrompt: true
    });

    let intervalRef = null;

    // Helper: Logic that was previously inside the component
    function parseMarkdown(text) {
        return DOMPurify.sanitize(marked.parse(text));
    }

    async function submitPrompt(promptText) {
        const userPrompt = promptText.trim();
        const state = get({ subscribe }); // Get current state without subscribing

        if (!userPrompt || state.isLoading || state.jobDone === false) return;

        // 1. Update UI for Start
        const aiPlaceholderId = Date.now() + 1;
        update(s => ({
            ...s,
            isLoading: true,
            jobDone: false,
            errorMessage: '',
            messageHistory: [
                ...s.messageHistory,
                { id: Date.now(), sender: 'user', text: userPrompt },
                { id: aiPlaceholderId, sender: 'ai', text: 'Thinking...' }
            ]
        }));

        try {
            let jobRef = state.latestJobRef;
            
            // 2. API Calls
            if (state.isInitPrompt) {
                jobRef = await callTaskApi(userPrompt);
                update(s => ({ ...s, latestJobRef: jobRef, isInitPrompt: false }));
            } else {
                await postAmendApi(userPrompt, jobRef);
            }

            // 3. Update Placeholder
            updateMessage(aiPlaceholderId, `Job ${jobRef} has been submitted...`);

            // 4. Polling Logic
            startPolling(jobRef, aiPlaceholderId);

        } catch (error) {
            update(s => ({
                ...s,
                isLoading: false,
                errorMessage: 'Failed to get response. Please try again.',
                messageHistory: s.messageHistory.filter(msg => msg.id !== aiPlaceholderId)
            }));
        }
    }

    function startPolling(jobRef, aiMsgId) {
        if (intervalRef) clearInterval(intervalRef);

        intervalRef = setInterval(async () => {
            try {
                const updateResult = await checkForUpdate(jobRef);
                const { status, data } = updateResult.response;

                if (status === 'Complete' || status === 'Failed') {
                    stopPolling();
                    update(s => ({ ...s, jobDone: true, isLoading: false }));

                    if (status === 'Complete' && data.output) {
                        update(s => ({ ...s, stats: data.stats }));
                        updateMessage(aiMsgId, data.output);
                    } else {
                        updateMessage(aiMsgId, `Job ${jobRef} Failed ☹️`);
                    }
                } else {
                    // Ongoing status
                    updateMessage(aiMsgId, `Job ${jobRef} : **${data}**`);
                }
            } catch (err) {
                stopPolling();
                update(s => ({ ...s, isLoading: false, errorMessage: 'Polling failed.' }));
            }
        }, 2000);
    }

    function updateMessage(id, text) {
        update(s => ({
            ...s,
            messageHistory: s.messageHistory.map(msg => 
                msg.id === id ? { ...msg, text: parseMarkdown(text) } : msg
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
            isInitPrompt: true
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