<script>
    import { chatStore } from '$lib/code/Stores/chatStore.js';
    import Sidebar from '$lib/componants/Sidebar.svelte';
    import { slide } from 'svelte/transition';
    import SettingsModal from '$lib/componants/SettingsModal.svelte';
    import { onMount, tick } from 'svelte';
    import { invoke } from '@tauri-apps/api/core';
    import { open } from '@tauri-apps/plugin-dialog';
    
    let isSettingsOpen = false;
    let isSidebarCollapsed = true;
    let prompt = '';
    let inputTextArea;
    let chatContainer; 
    let lastMessageCount = 0;
    let agentName = "Botzy Bee";
    let providerName = "Default"

    // For slash command menu
    let menuOpen = false;
    let filteredOptions = [];
    let selectedIndex = 0;

    onMount(() =>{
        chatStore.reset();
    });

    function toggleSidebar() {
        isSidebarCollapsed = !isSidebarCollapsed;
    }

    function toggleSettings() {
        isSettingsOpen = !isSettingsOpen;
    }

    // Intelligent Scroll Logic
    $: if ($chatStore.messageHistory && chatContainer) {
        const currentCount = $chatStore.messageHistory.length;
        const isNewMessage = currentCount > lastMessageCount;

        // Update agent name if it exists in settings
        if($chatStore.aiSettings.agent){
            agentName = $chatStore.aiSettings.agent;
        }

        if($chatStore.aiSettings.provider && $chatStore.aiSettings?.randomModel != true){
            providerName = $chatStore.aiSettings.provider;  
        } else if($chatStore.aiSettings.randomModel == true){
            providerName = "Multiple Providers";  
        }

        // Calculate if user is near the bottom (within 100px)
        const threshold = 100;
        const isNearBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < threshold;

        if (isNewMessage || isNearBottom) {
            setTimeout(() => {
                chatContainer.scrollTo({
                    top: chatContainer.scrollHeight,
                    behavior: isNewMessage ? 'smooth' : 'auto'
                });
            }, 50);
        }
        lastMessageCount = currentCount;
    }

    function adjustHeight(node) {
        node.style.height = 'auto';
        node.style.height = Math.min(node.scrollHeight, 300) + 'px';
    }

    function promptInput(e){
        const cursor = e.target.selectionStart;
        const textBeforeCursor = prompt.slice(0, cursor);
        const words = textBeforeCursor.split(/\s/);
        const lastWord = words[words.length - 1];

        if (lastWord.startsWith("/")) {
        const query = lastWord.slice(1).toLowerCase();
        
        // 1. Initial Categories
        let options = [
            { label: 'folder', icon: '📁', type: 'cmd' },
            { label: 'file', icon: '📄', type: 'cmd' }
        ];

        // 2. If user typed "/folder " or similar, we could trigger Rust here
        // For this example, we filter the initial command list
        filteredOptions = options.filter(opt => 
            opt.label.toLowerCase().includes(query)
        );

        menuOpen = filteredOptions.length > 0;
        } else {
        menuOpen = false;
        }
    }

    async function handleSubmit(event) {
        event.preventDefault();
        const userPrompt = prompt.trim();
        if (!userPrompt || $chatStore.isLoading || $chatStore.jobDone === false) return;
        // The store handles API logic, polling, and markdown parsing
        await chatStore.submitPrompt({ promptText: userPrompt });
        prompt = '';
        if (inputTextArea) inputTextArea.style.height = 'auto';
    }

    function handleKeydown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSubmit(event);
            return;
        }
    }

    // For slash command menu - handles both cmd options and tools (if implemented)
    async function selectOption(option) {
        const cursor = inputTextArea.selectionStart;
        const textBeforeCursor = prompt.slice(0, cursor);
        const textAfterCursor = prompt.slice(cursor);

        // Find the start of the command (the last '/' before the cursor)
        const lastSlashIndex = textBeforeCursor.lastIndexOf('/');
        
        // We keep everything BEFORE the slash exactly as it is (preserving newlines)
        const baseText = textBeforeCursor.slice(0, lastSlashIndex);
        let replacement = "";

        if (option.label === 'folder' || option.label === 'file') {
            try {
                const selected = await open({
                    directory: option.label === 'folder',
                    multiple: false,
                    defaultPath: import.meta.env.VITE_KNOWLEDGEBASE_PATH
                });

                if (selected) {
                    let selectedPath = selected.replace(/\\/g, '/');
                    const basePath = import.meta.env.VITE_KNOWLEDGEBASE_PATH.replace(/\\/g, '/');
                    const base = new URL(`file:///${basePath}/`);
                    const target = new URL(`file:///${selectedPath}`);
                    let relative = target.pathname.replace(base.pathname, '');
                    
                    if (!relative.startsWith('/')) {
                        relative = '/' + relative;
                    }
                    replacement = relative;
                } else {
                    // If user cancels, we might want to put the slash back or leave it
                    replacement = "/"; 
                }
            } catch (err) {
                console.error("Dialog error:", err);
                replacement = "/";
            }
        } else {
            // It's a tool or a specific command
            replacement = `[${option.label}]`;
        }

        // Combine: everything before slash + the new text + everything after cursor
        prompt = baseText + replacement + textAfterCursor;
        menuOpen = false;

        await tick();
        inputTextArea.focus();
        
        // Optional: Set cursor position to after the injected text
        const newCursorPos = baseText.length + replacement.length;
        inputTextArea.setSelectionRange(newCursorPos, newCursorPos);
    }
    
    // Helper to determine CSS class based on Role
    const getRoleClass = (role) => role?.toLowerCase() === 'user' ? 'user-message' : 'ai-response';
</script>

<div class="app-container">
    <Sidebar 
        bind:isSidebarCollapsed={isSidebarCollapsed} 
        on:toggle={toggleSidebar} 
    />

    <button
        class="new-chat-btn"
        class:show={isSidebarCollapsed}
        on:click={chatStore.reset}
        aria-label="Start New Chat"
    >
        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#FFFFFF"><path d="M440-400h80v-120h120v-80H520v-120h-80v120H320v80h120v120ZM80-80v-720q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H240L80-80Zm126-240h594v-480H160v525l46-45Zm-46 0v-480 480Z"/></svg>
    </button>

    <button
        class="settings-btn"
        class:show={isSidebarCollapsed}
        on:click={toggleSettings}
        aria-label="AI Settings"
    >
        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#FFFFFF">
        <path d="m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-1 13.5l103 78-110 190-119-50q-11 8-23 15t-24 12L590-80H370Zm112-260q58 0 99-41t41-99q0-58-41-99t-99-41q-58 0-99 41t-41 99q0 58 41 99t99 41Z"/> -->
        </svg>
    </button>

    <SettingsModal 
        isOpen={isSettingsOpen} 
        on:close={() => isSettingsOpen = false} 
    />

    <main class="main-content" bind:this={chatContainer}>
        
        <div class="content-display">
            {#if $chatStore.messageHistory.length === 0}
                <div class="start-message">
                    <p>Welcome to Botzy Bee.. give me a task or ask a question</p>
                    <p style="padding-top: 5px; color: #FFF; font-size: 14px;">Using Agent : {agentName}</p>
                    <p style="padding-top: 5px; color: #FFF; font-size: 14px;">Provider : {providerName}</p>
                </div>
            {/if}
            
            <!-- Output Message History -->
            {#each $chatStore.messageHistory as message}
                <!--Text Message-->
                <div class={getRoleClass(message.role)}>        
                    {#if message.type === 'text'}
                        <p>{@html message.textData}</p>
                    {/if}

                    {#if message.type === 'image'}
                        <div class="image-container">
                            <img 
                                src={message.base64 ? message.base64 : message.url} 
                                alt={message.altText || 'AI Image'} 
                                class="chat-image" 
                            />
                        </div>
                    {/if}
                </div>
            {/each}

            {#if $chatStore.latestJobRef && $chatStore.jobDone === false}
                <div class="ai-response status-update" transition:slide>
                    <p><i>{$chatStore.lastStatus || 'Processing...'}</i></p>
                    <button on:click={chatStore.cancelTask} class="cancel-link">
                        Cancel Task
                    </button>
                </div>
            {/if}

            {#if $chatStore.jobDone === true}
                <div class="stats-container" transition:slide>
                    <hr class="stats-divider"/>
                    <p class="stats-text">
                        AiCalls: {$chatStore.stats.aiCount}, 
                        ToolCalls: {$chatStore.stats.toolCount}, 
                        Loops: {$chatStore.stats.loopNumber}
                    </p>
                </div>
            {/if}

            {#if $chatStore.errorMessage}
                <div class="error-message">
                    <p>{$chatStore.errorMessage}</p>
                </div>
            {/if}
        </div>

        <div class="input-form-container">

            <form on:submit={handleSubmit} class="input-form">
                <!-- Slash Command Menu -->
                {#if menuOpen}
                <ul class="dropdown" transition:slide={{ duration: 200 }}>
                    {#each filteredOptions as opt, i}
                    <li>
                        <button type="button" class:active={i === selectedIndex} on:mousedown={() => selectOption(opt)}>
                            <span class="icon" style="cursor: pointer;">{opt.icon}</span>
                            <span class="label" style="cursor: pointer;">{opt.label}</span>
                        </button>
                    </li>
                    {/each}
                </ul>
                {/if}
                <!-- Input Prompt -->
                <textarea
                    bind:value={prompt}
                    bind:this={inputTextArea}
                    on:input={(event) => {adjustHeight(inputTextArea); promptInput(event)}}
                    on:keydown={handleKeydown}
                    placeholder="Message Agent..."
                    rows="1"
                    class="input-textarea"
                    disabled={($chatStore.isLoading && $chatStore.jobDone === false) && $chatStore.errorMessage === ""}
                ></textarea>

                <!-- Submit Button -->
                <button type="submit" class="send-button" disabled={$chatStore.isLoading || !prompt.trim() || $chatStore.jobDone === false}>
                    {#if $chatStore.isLoading && $chatStore.jobDone === false}
                        <svg class="spinner" viewBox="0 0 50 50">
                            <circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle>
                        </svg>
                    {:else}
                        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M2.01 21.01L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                    {/if}
                </button>
            </form>
        </div>
    </main>
</div>

<style>
/* 1. Fix the Code Block Container */
    :global(.ai-response pre), :global(.user-message pre) {
        background-color: #2d2d2d; /* Professional dark theme */
        color: #f8f8f2;
        padding: 16px;
        border-radius: 12px;
        margin: 12px 0;
        
        /* The Magic Sauce */
        overflow-x: auto;   /* Adds horizontal scrollbar when needed */
        max-width: 100%;    /* Constrains it to the message bubble width */
        display: block;     /* Ensures it behaves as a block */
    }

    /* 2. Style the Code inside the block */
    :global(.ai-response pre code) {
        font-family: 'Fira Code', 'Cascadia Code', monospace;
        font-size: 0.9rem;
        line-height: 1.5;
        white-space: pre;   /* Forces horizontal scroll rather than wrapping */
        background: transparent; /* Remove background if already on 'pre' */
        padding: 0;
    }

    /* 3. Style Inline Code (e.g. `const x = 1`) */
    :global(.ai-response :not(pre) > code) {
        background-color: rgba(0, 0, 0, 0.1);
        padding: 2px 6px;
        border-radius: 4px;
        font-family: monospace;
        font-size: 0.95em;
        word-break: break-word; /* Let inline code wrap if it's too long */
    }

    /* Slash Command Menu */
    .dropdown {
        position: absolute;
        bottom: 100%;      /* Changed from top: 100% */
        left: 0;
        right: 0;
        background: #222;
        border: 1px solid #444;
        border-radius: 12px;
        margin-bottom: 10px; /* Spacing between menu and input */
        list-style: none;
        padding: 5px 0;
        overflow-y: auto;    /* Allow scrolling if list is long */
        max-height: 300px;   /* Keep it within viewable area */
        z-index: 1000;       /* Ensure it floats above chat history */
        box-shadow: 0 -4px 12px rgba(0,0,0,0.2); /* Shadow on the top side */
    }

    .dropdown li {
        padding: 0.75rem 1rem;
        display: flex;
        gap: 12px;
        cursor: pointer;
        color: #ccc;
    }

    .dropdown li.active {
        background: #333;
        color: white;
    }

    /* Crucial CSS for the button within each list item */
    .dropdown button {
        display: flex; /* Use flexbox to align icon and label nicely */
        align-items: center; /* Vertically centres content */
        width: 100%; /* THIS IS KEY: Makes the button span the full width of its parent <li> */
        padding: 8px 12px; /* Adjust padding as needed for item height and spacing */
        border: none; /* Removes default button border */
        background-color: transparent; /* Ensures no default button background */
        text-align: left; /* Aligns text to the left */
        cursor: pointer; /* Applies the pointer cursor to the entire button area */
        font-size: inherit; /* Inherit font size from parent */
        color: #f0f0f0; /* Default text colour */
        outline: none; /* Removes default focus outline for better aesthetics, but consider a custom focus style for accessibility */
        transition: background-color 0.2s ease; /* Smooth hover transition */
    }
    
    /* Styling for the icon and label spans */
    .dropdown button .icon {
        margin-right: 8px; /* Space between icon and label */
        /* Remove inline 'cursor: pointer;' from here */
    }

    .dropdown button .label {
        flex-grow: 1; /* Allows the label to take up remaining space */
        /* Remove inline 'cursor: pointer;' from here */
    }

    .icon { opacity: 0.7; }
    
    :root {
        --sidebar-width: 250px;
        --open-btn-size: 48px;
        --input-form-max-width: 900px;
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

    .chat-image {
        max-width: 100%;
        max-height: 400px;
        border-radius: 8px;
        display: block;
        margin: 10px 0;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }

    .cancel-link {
        background: none;
        border: none;
        color: #ff4444;
        text-decoration: underline;
        cursor: pointer;
        font-size: 0.85rem;
        padding: 0;
    }

    .status-update {
        opacity: 0.8;
        font-size: 0.9rem;
    }

    .app-container {
        display: flex;
        height: 100vh;
        overflow: hidden; 
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

    .input-form-container {
        position: sticky;
        bottom: 0;
        width: 100%;
        display: flex;
        justify-content: center;
        background: linear-gradient(transparent, rgba(25, 90, 165, 0.719) 95%); 
        padding: 20px;
        box-sizing: border-box;
        pointer-events: none; 
    }

    .input-form {
        position: relative;
        pointer-events: auto; /* Re-enable clicks for the actual input */
        width: 100%;
        max-width: var(--input-form-max-width);
        background-color: #ffffff;
        border-radius: 24px;
        padding: 10px 16px;
        display: flex;
        align-items: center;
        box-shadow: var(--shadow-medium);
        border: 1px solid var(--border-color);
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
        overflow-y: auto; /* Scrollbar appears here (far right) */
        overflow-x: hidden;
        position: relative;
        scroll-behavior: smooth;
    }

    .content-display {
        flex-grow: 1;
        width: 100%;
        max-width: var(--input-form-max-width);
        margin: 0 auto; /* Keep content centered */
        display: flex;
        flex-direction: column;
        gap: 15px;
        padding: 40px 20px 100px 20px; /* Large bottom padding so text isn't hidden by input */
    }

    .start-message {
        align-self: center;
        text-align: center;
        color: #3d3d3d;
        margin-top: 150px;
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

    .new-chat-btn {
        position: fixed;
        left: 0;
        top: 175px;
        z-index: 5;
        background-color: var(--user-message-border);
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

    .settings-btn {
        position: fixed;
        left: 0;
        top: 230px;
        z-index: 5;
        background-color: var(--user-message-border);
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

    .settings-btn.show {
        transform: translateX(0);
    }

    .settings-btn svg {
        fill: currentColor;
    }

    /* Input Form Styles */
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
        overflow-y: auto;
        max-height: 300px;
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