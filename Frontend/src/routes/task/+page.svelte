<script>
    import { chatStore } from '$lib/code/agentChat/chatStore_example.js';
    import Sidebar from '$lib/componants/Sidebar.svelte';
    import { quintOut } from 'svelte/easing';
    import { slide } from 'svelte/transition';
    import BotzyLogo from '$lib/logoSml.png';
    import LayoutCombine from '$lib/componants/layoutCombine.svelte';
    import { callTaskApi, checkForUpdate, postAmendApi, stopTask } from '$lib/code/aiJobs/call.js';
    import { marked } from 'marked';
    import DOMPurify from 'dompurify';

    let isSidebarCollapsed = true;
    function toggleSidebar() {
        isSidebarCollapsed = !isSidebarCollapsed;
    }

    let prompt = '';
    let isLoading = false;
    let isInitPrompt = true;
    let errorMessage = '';
    let inputTextArea;
    let latestJobRef = null;
    let jobDone = null;
    let intervalRef = null;
    let stats = { toolCount: 0, aiCount: 0, loopNumber: 0 };
    let messageHistory = []; // Array to store all messages

    // Variable to hold the ID of the last AI message, so we can update it
    let latestAiMessageId = null;

    // We'll use this to scroll the chat to the bottom
    let chatContainer;

    // Automatically scroll to the bottom of the chat when a new message is added
    function scrollToBottom() {
        if (chatContainer) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    }

    // Call this whenever messageHistory changes
    $: {
        scrollToBottom();
    }

    // Adjust the height of the textarea
    function adjustHeight(node) {
        node.style.height = 'auto';
        node.style.height = Math.min(node.scrollHeight, 200) + 'px';
    }

    function parseAndSanitizeMarkdown(markdownText) {
        const rawHtml = marked.parse(markdownText);
        const sanitizedHtml = DOMPurify.sanitize(rawHtml);
        return sanitizedHtml;
    }


    // Handle Submit new prompt
    async function handleSubmit(event) {
        event.preventDefault();
        const userPrompt = prompt.trim();
        if (!userPrompt || isLoading || jobDone === false) return;

        isLoading = true;
        jobDone = false;
        errorMessage = '';

        // Add user's message to the history
        messageHistory = [...messageHistory, {
            id: Date.now(),
            sender: 'user',
            text: userPrompt
        }];

        // Add a placeholder message for the AI
        const aiPlaceholderId = Date.now() + 1;
        messageHistory = [...messageHistory, {
            id: aiPlaceholderId,
            sender: 'ai',
            text: 'Thinking...' // Initial message
        }];
        latestAiMessageId = aiPlaceholderId; // Keep track of this message's ID

        prompt = '';
        if (inputTextArea) { inputTextArea.style.height = 'auto'; }

        try {
            // Init Prompt
            if(isInitPrompt == true){
                let res = await callTaskApi(userPrompt);
                latestJobRef = res;
                isInitPrompt = false;
            } else {
                // Follow up prompts
                await postAmendApi(userPrompt, latestJobRef); 
            }


            // Update the placeholder AI message with the job submission status
            const initialAiMessage = messageHistory.find(msg => msg.id === latestAiMessageId);
            if (initialAiMessage) {
                initialAiMessage.text = parseAndSanitizeMarkdown(`Job ${latestJobRef} has been submitted...`);
                messageHistory = [...messageHistory]; // Trigger reactivity
            }

            // Set interval to check for an update
            intervalRef = setInterval(async () => {
                const updateResult = await checkForUpdate(latestJobRef);
                const currentAiMessage = messageHistory.find(msg => msg.id === latestAiMessageId);

                if (updateResult.response.status === 'Complete' || updateResult.response.status === 'Failed') {
                    clearInterval(intervalRef);
                    jobDone = true;
                    if(currentAiMessage){
                        if(updateResult.response.status === 'Complete' && updateResult.response.data.output != null){
                            const resultText = updateResult.response.data.output;
                            stats = updateResult.response.data.stats;
                            currentAiMessage.text = parseAndSanitizeMarkdown(resultText);
                        } else {
                            currentAiMessage.text = parseAndSanitizeMarkdown(`Job ${latestJobRef} Failed ☹️`);
                        }
                        messageHistory = [...messageHistory]; // Trigger reactivity
                    }
                } else {
                    if (currentAiMessage) {
                        currentAiMessage.text = parseAndSanitizeMarkdown(`Job ${latestJobRef} : **${updateResult.response.data}**`);
                        messageHistory = [...messageHistory]; // Trigger reactivity
                    }
                }
            }, 2000);
        } catch (error) {
            errorMessage = 'Failed to get response. Please try again.';
            console.error('API Error:', error);
            // If the initial request fails, remove the placeholder
            messageHistory = messageHistory.filter(msg => msg.id !== latestAiMessageId);
        } finally {
            isLoading = false;
        }
    }

    // handle keydown events in the textarea
    function handleKeydown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSubmit(event);
        }
    }

    // new chat reload
    function startNewChat() {
        if (intervalRef) {
            clearInterval(intervalRef);
        }
        messageHistory = [];
        prompt = '';
        isLoading = false;
        errorMessage = '';
        latestJobRef = null;
        jobDone = null;
        latestAiMessageId = null;
        isInitPrompt = true;
        if (inputTextArea) { inputTextArea.style.height = 'auto'; }
    }

    // stop task
    async function stop(){
        await stopTask(latestJobRef);
    }
</script>

<div class="app-container">
    <!-- SIDEBAR -->
    <Sidebar 
        bind:isSidebarCollapsed={isSidebarCollapsed} 
        on:toggle={toggleSidebar} 
    />
    <!-- New Chat button -->
    <button
        class="new-chat-btn"
        class:show={isSidebarCollapsed}
        on:click={startNewChat}
        aria-label="Start New Chat"
    >
        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#000000"><path d="M440-400h80v-120h120v-80H520v-120h-80v120H320v80h120v120ZM80-80v-720q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H240L80-80Zm126-240h594v-480H160v525l46-45Zm-46 0v-480 480Z"/></svg>
    </button>
    <!-- MAIN CONTENT -->
    <main class="main-content">
        <!-- This div will contain chat messages or other main content -->
        <div class="content-display" bind:this={chatContainer}>
            {#if messageHistory.length === 0}
                <div class="start-message">
                    <p>Welcome to the Hive.. give me a task or ask a question</p>
                </div>
            {/if}

            {#each messageHistory as message (message.id)}
                <div class="{message.sender === 'user' ? 'user-message' : 'ai-response'}">
                    <p>{@html message.text}</p>
                    <!-- Cancel Button -->
                    {#if message.sender === 'ai' && message.id === latestAiMessageId && jobDone === false}
                        <button
                                on:click={stop}
                                aria-label="Cancel Task"
                                style="cursor: pointer;"
                            >
                            <p class="stats-text">Cancel Task</p>
                        </button>
                    {/if}
                    {#if message.sender === 'ai' && message.id === latestAiMessageId && jobDone === true}
                        <div class="stats-container">
                            <hr class="stats-divider"/>
                            <p class="stats-text">AiCalls: {stats.aiCount}, ToolCalls: {stats.toolCount}, Loops: {stats.loopNumber}</p>
                        </div>
                    {/if}
                </div>
            {/each}

            {#if errorMessage}
                <div class="error-message">
                    <p>{errorMessage}</p>
                </div>
            {/if}
        </div>

        <!-- Input Form - positioned at the bottom of main-content using flexbox -->
        <form on:submit={handleSubmit} class="input-form">
            <textarea
                bind:value={prompt}
                bind:this={inputTextArea}
                on:input={() => adjustHeight(inputTextArea)}
                on:keydown={handleKeydown}
                placeholder="Message Botzy AI..."
                rows="1"
                class="input-textarea"
                aria-label="AI prompt input"
                tabindex="0"
            ></textarea>
            <button type="submit" class="send-button" disabled={isLoading || !prompt.trim() || jobDone === false}>
                {#if isLoading || jobDone === false}
                    <!-- Spinner for loading state -->
                    <svg class="spinner" viewBox="0 0 50 50">
                        <circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle>
                    </svg>
                {:else}
                    <!-- Send icon -->
                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0z" fill="none"/><path d="M2.01 21.01L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                {/if}
            </button>
        </form>
    </main>
</div>

<style>
    :root {
        --sidebar-width: 250px;
        --open-btn-size: 48px;
        --input-form-max-width: 768px;
        --primary-blue: #4285f4;
        --primary-blue-dark: #357ae8;
        --text-color-light: #fefefe;
        --text-color-dark: #333;
        --border-color: #e0e0e0;
        --shadow-light: 0 2px 10px rgba(0, 0, 0, 0.08); /* Light shadow for elements */
        --shadow-medium: 0 4px 20px rgba(0, 0, 0, 0.1); /* More prominent shadow for input form */
        --user-message-bg: #f0f4f9; /* Lighter background for user messages */
        --ai-message-bg: #e6f0ff; /* Light blue background for AI responses */
        --ai-message-border: #005188; /* Accent border for AI responses */
        --user-message-border: #0098ac; /* Light aquamarine for user messages */
    }

    .app-container {
        display: flex;
        min-height: 100vh;
        height: 100vh;
        box-sizing: border-box;
    }

    .sidebar {
        width: var(--sidebar-width);
        background-color: #ffffff;
        padding: 20px;
        box-shadow: var(--shadow-light);
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        flex-shrink: 0;
        overflow: hidden;
        z-index: 10;
        position: relative;
        transition: width 0.3s ease-in-out, padding 0.3s ease-in-out;
    }

    .sidebar-logo {
        width: 32px;
        height: 32px;
    }

    .sidebar.collapsed {
        width: 0;
        padding: 0;
    }

    .sidebar-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        gap: 8px;
        margin-bottom: 20px;
        box-sizing: border-box;
    }

    .sidebar-branding {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 1;
        min-width: 0;
    }

    .sidebar-title {
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--text-color-dark);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .sidebar ul {
        list-style: none;
        padding: 0;
        margin: 0;
        width: 100%;
    }

    .sidebar ul li {
        margin-bottom: 8px;
    }

    .sidebar ul li a {
        display: block;
        padding: 10px 15px;
        border-radius: 8px;
        color: var(--text-color-dark);
        text-decoration: none;
        transition: background-color 0.2s ease, color 0.2s ease;
    }

    .sidebar ul li a:hover {
        background-color: #f0f0f0;
        color: var(--primary-blue);
    }

    .collapse-button {
        background: none;
        border: none;
        cursor: pointer;
        padding: 5px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #666;
        transition: background-color 0.2s ease, color 0.2s ease;
        flex-shrink: 0;
        margin-left: auto;
        height: 36px;
        width: 36px;
    }

    .collapse-button:hover {
        background-color: #f0f0f0;
        color: #333;
    }

    .collapse-button svg {
        fill: currentColor;
        width: 20px;
        height: 20px;
    }

    .main-content {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        box-sizing: border-box;
    }

    .content-display {
        flex-grow: 1;
        width: 100%;
        max-width: var(--input-form-max-width);
        /* padding-bottom: 10px; */
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        gap: 15px; /* Add spacing between messages */
        padding-right: 1.25rem; /* Space for scrollbar */
    }

    .start-message {
        align-self: center;
        text-align: center;
        color: #545454;
        margin-top: 50px;
    }

    .user-message, .ai-response, .error-message {
        padding: 15px;
        border-radius: 18px; /* Consistent rounded corners */
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        max-width: 90%;
        word-wrap: break-word;
        white-space: pre-wrap; /* Preserve whitespace and line breaks from markdown */
    }

    /* Styles for user messages */
    .user-message {
        background-color: var(--user-message-bg);
        align-self: flex-end; /* Align user messages to the right */
        border-right: 4px solid var(--user-message-border); /* Mirrored accent border */
        border-bottom-right-radius: 4px; /* A slight style variation */
        color: var(--text-color-dark);
    }

    /* Styles for AI responses */
    .ai-response {
        background-color: var(--ai-message-bg);
        border-left: 4px solid var(--ai-message-border); /* Accent border */
        align-self: flex-start; /* Align AI messages to the left */
        border-top-left-radius: 4px; /* A slight style variation */
        color: var(--text-color-dark);
    }

    .error-message {
        background-color: #ffe6e6;
        border-color: #dc3545;
        border-left: 4px solid;
        color: #dc3545;
        align-self: flex-start;
        max-width: 100%;
    }

    .stats-container {
        margin-top: 2px;
        padding-top: 2%;
    }

    .stats-divider {
        border: 0;
        height: 1px;
        background-color: #ddd;
    }

    .stats-text {
        font-size: 0.8rem;
        color: #666;
        text-align: left;
    }

    /* Styles for the "Open Sidebar" button (appears when sidebar is collapsed) */
    .open-sidebar-btn {
        position: fixed;
        left: 0;
        top: 20px;
        z-index: 5;
        background-color: var(--primary-blue);
        color: white;
        border: none;
        width: var(--open-btn-size);
        height: var(--open-btn-size);
        display: flex;
        justify-content: center;
        align-items: center;
        cursor: pointer;
        border-top-right-radius: 8px;
        border-bottom-right-radius: 8px;
        box-shadow: 2px 0 5px rgba(0,0,0,0.2);
        transition: transform 0.3s ease-in-out;
        transform: translateX(-100%);
    }

    .open-sidebar-btn.show {
        transform: translateX(0);
    }

    .open-sidebar-btn svg {
        fill: currentColor;
    }

    .new-chat-btn {
        position: fixed;
        left: 0;
        top: 70px;
        z-index: 5;
        background-color: var(--primary-blue);
        color: white;
        border: none;
        width: var(--open-btn-size);
        height: var(--open-btn-size);
        display: flex;
        justify-content: center;
        align-items: center;
        cursor: pointer;
        border-top-right-radius: 8px;
        border-bottom-right-radius: 8px;
        box-shadow: 2px 0 5px rgba(0,0,0,0.2);
        transition: transform 0.3s ease-in-out;
        transform: translateX(-100%);
    }

    .new-chat-btn.show {
        transform: translateX(0);
    }

    .new-chat-btn svg {
        fill: currentColor;
    }

    /* Input Form Styles - The core of the modern AI look */
    .input-form {
        position: sticky;
        bottom: 0;
        width: 100%;
        max-width: var(--input-form-max-width);
        background-color: #ffffff;
        border-radius: 24px;
        padding: 10px 16px;
        display: flex;
        align-items: center;
        box-shadow: var(--shadow-medium);
        border: 1px solid var(--border-color);
        margin-top: 20px;
        box-sizing: border-box;
    }

    .input-textarea {
        flex-grow: 1;
        border: none;
        outline: none;
        background: transparent;
        font-size: 1rem;
        line-height: 1.5;
        padding: 8px 0;
        resize: none;
        color: var(--text-color-dark);
        transition: border-color 0.2s ease;
        overflow-y: hidden;
        max-height: 200px;
    }

    .input-textarea::placeholder {
        color: #999;
    }

    .send-button {
        background-color: var(--primary-blue);
        color: white;
        border: none;
        border-radius: 50%;
        width: 44px;
        height: 44px;
        min-width: 44px;
        min-height: 44px;
        display: flex;
        justify-content: center;
        align-items: center;
        cursor: pointer;
        margin-left: 12px;
        transition: background-color 0.3s ease, transform 0.2s ease, box-shadow 0.3s ease;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
    }

    .send-button:hover:not(:disabled) {
        background-color: var(--primary-blue-dark);
        transform: translateY(-1px);
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
    }

    .send-button:active:not(:disabled) {
        transform: translateY(0);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .send-button:disabled {
        background-color: #a0c3fc;
        cursor: not-allowed;
        opacity: 0.7;
        box-shadow: none;
    }

    .send-button svg {
        fill: white;
        width: 22px;
        height: 22px;
    }

    /* Spinner styles for loading state */
    .spinner {
        animation: rotate 2s linear infinite;
        z-index: 2;
        width: 24px;
        height: 24px;
    }

    .spinner .path {
        stroke: white;
        stroke-linecap: round;
        animation: dash 1.5s ease-in-out infinite;
    }

    @keyframes rotate {
        100% {
            transform: rotate(360deg);
        }
    }

    @keyframes dash {
        0% {
            stroke-dasharray: 1, 150;
            stroke-dashoffset: 0;
        }
        50% {
            stroke-dasharray: 90, 150;
            stroke-dashoffset: -35;
        }
        100% {
            stroke-dasharray: 90, 150;
            stroke-dashoffset: -124;
        }
    }

    /* Responsive adjustments for smaller screens */
    @media (max-width: 768px) {
        .sidebar {
            position: fixed;
            height: 100vh;
            top: 0;
            left: 0;
            width: var(--sidebar-width);
            transform: translateX(-100%);
            transition: transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out;
        }

        .sidebar:not(.collapsed) {
            transform: translateX(0%);
            box-shadow: 2px 0 10px rgba(0,0,0,0.2);
        }

        .sidebar.collapsed {
            transform: translateX(-100%);
        }

        .open-sidebar-btn {
            transform: translateX(0);
            left: 0;
            top: 10px;
        }

        .main-content {
            padding: 10px;
        }

        .input-form {
            border-radius: 18px;
            padding: 8px 12px;
        }

        .send-button {
            width: 40px;
            height: 40px;
            min-width: 40px;
            min-height: 40px;
        }

        .input-textarea {
            font-size: 0.95rem;
        }
    }
</style>