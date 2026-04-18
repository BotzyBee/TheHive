<script>
    import { fade, fly } from 'svelte/transition';
    import { createEventDispatcher } from 'svelte';
    import { chatStore } from '$lib/code/Stores/chatStore.js';
    import { onMount } from 'svelte';
    import { getConfig } from '$lib/code/utils.js';

    export let isOpen = false;
    export let showAgents = true;
    export let showWebCheckbox = false;

    const dispatch = createEventDispatcher();
    // Placeholder data - you can move these to a store later
    let providers = [];
    let qualities = [];
    let agents = [];
    let selectedProvider = [];
    let selectedQuality = [];
    let selectedAgent = [];
    let randomModel = false;
    let webGrouding = false;

onMount(() => {
    const init = async () => {
        const cfg = await chatStore.fetchConfig();  
        agents = Object.values(cfg.Agents) || [];
        providers = Object.values(cfg.AiProviders) || [];  
        qualities = Object.keys(cfg.AiQuality) || [];
        selectedProvider = providers[1];
        selectedQuality = qualities[1];
        selectedAgent = agents[0];
    };
    init();
});



    function close() {
        dispatch('close');
    }

    function save() {
        // find what index slectedQuality is in qualities and set that as the quality in chatStore
        const qualityIndex = qualities.indexOf(selectedQuality) +1;
        chatStore.updateAISettings({
            provider: selectedProvider,
            quality: qualityIndex,
            agent: selectedAgent,
            randomModel: randomModel
        });
        chatStore.updateWebGrounding(webGrouding);
        close();
    }

    // Close modal if Escape key is pressed anywhere
    function handleGlobalKeydown(event) {
        if (isOpen && event.key === 'Escape') {
            close();
        }
    }
</script>

<svelte:window on:keydown={handleGlobalKeydown} />

{#if isOpen}
<div 
    class="modal-backdrop" 
    on:click={close}
    on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && close()}
    role="button"
    tabindex="0"
    aria-label="Close modal"
    transition:fade={{ duration: 200 }}
>
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div 
        class="modal-content" 
        on:click|stopPropagation
        role="document"
    >
            <div class="modal-header">
                <h2>AI Settings</h2>
                <button class="close-icon" on:click={close}>&times;</button>
            </div>

            <div class="modal-body">
                <div class="setting-group">
                    <label for="provider">AI Provider</label>
                    <select id="provider" bind:value={selectedProvider}>
                        {#each providers as item}
                            <option value={item}>{item}</option>
                        {/each} </select>
                </div>

                <div class="setting-group">
                    <label for="quality">AI Quality</label>
                    <select id="quality" bind:value={selectedQuality}>
                        {#each qualities as item}
                            <option value={item}>{item}</option>
                        {/each}
                    </select>
                </div>

                {#if showAgents == true}
                    <div class="setting-group">
                        <label for="agent">AI Agent</label>
                        <select id="agent" bind:value={selectedAgent}>
                            {#each agents as item}
                                <option value={item}>{item}</option>
                            {/each}
                        </select>
                    </div>
                {/if}
                <div class="setting-group flex items-center justify-between">
                    <label for="randomModel" class="text-sm font-medium text-gray-700">Random Model</label>
                    
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            id="randomModel" 
                            bind:checked={randomModel} 
                            class="sr-only peer"
                        />
                        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>

                {#if showWebCheckbox == true}
                    <div class="setting-group flex items-center justify-between">
                        <label for="webGrounding" class="text-sm font-medium text-gray-700">Use Web Grounding (if Available)</label>
                        
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                id="webGrounding" 
                                bind:checked={webGrouding} 
                                class="sr-only peer"
                            />
                            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                {/if}
            </div>

            <div class="modal-footer">
                <button class="btn-secondary" on:click={close}>Cancel</button>
                <button class="btn-primary" on:click={save}>Save Settings</button>
            </div>
        </div>
    </div>
{/if}

<style>
    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }

    .modal-content {
        background: white;
        width: 90%;
        max-width: 450px;
        border-radius: 24px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }

    .modal-header {
        padding: 20px 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #eee;
    }

    .modal-header h2 {
        margin: 0;
        font-size: 1.25rem;
        color: #333;
    }

    .close-icon {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #666;
    }

    .modal-body {
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    .setting-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .setting-group label {
        font-size: 0.9rem;
        font-weight: 600;
        color: #555;
    }

    select {
        padding: 12px;
        border-radius: 12px;
        border: 1px solid var(--border-color);
        background-color: #f9f9f9;
        font-size: 1rem;
        outline: none;
        transition: border-color 0.2s;
    }

    select:focus {
        border-color: var(--primary-blue);
    }

    .modal-footer {
        padding: 16px 24px;
        background: #f8f9fa;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
    }

    button {
        padding: 10px 20px;
        border-radius: 12px;
        font-weight: 600;
        cursor: pointer;
        border: none;
        transition: opacity 0.2s;
    }

    .btn-primary {
        background: var(--primary-blue);
        color: white;
    }

    .btn-secondary {
        background: #e0e0e0;
        color: #444;
    }

    button:hover {
        opacity: 0.9;
    }
</style>