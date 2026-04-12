<script>
    import Sidebar from '$lib/componants/Sidebar.svelte';
    import BotzyLogo from '$lib/logoSml.png';
    import LayoutCombine from '$lib/componants/layoutCombine.svelte';
    import { callTaskApi, checkForUpdate, postAmendApi, stopTask } from '$lib/code/aiJobs/call.js';
    import { marked } from 'marked';
    import DOMPurify from 'dompurify';
    import { getModels } from '$lib/code/utils.js';
    import { onMount } from 'svelte';

    let isSidebarCollapsed = true;
    function toggleSidebar() {
        isSidebarCollapsed = !isSidebarCollapsed;
    }

    // Initialize with a dummy pending promise so the {#await} block shows the loading state immediately.
    let modelsPromise = new Promise(() => {}); 

    onMount(() => {
        modelsPromise = getModels();
    });
</script>

<div class="app-container">
    <Sidebar 
        bind:isSidebarCollapsed={isSidebarCollapsed} 
        on:toggle={toggleSidebar} 
    />

 <main class="main-content">
        <div class="dashboard-container">
            <div class="mb-6 w-full flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 class="text-3xl font-bold text-slate-900 tracking-tight">Model Directory</h1>
                </div>
                <!-- Maybe have a socket connection status here? -->
                <!-- <div class="flex gap-2">
                    <span class="text-xs font-medium px-3 py-1 bg-white border border-slate-200 rounded-full text-slate-600 shadow-sm">
                        System Status: Operational
                    </span>
                </div> -->
            </div>

            <div class="portal overflow-y-auto custom-scrollbar">
                {#await modelsPromise}
                    <div class="flex flex-col justify-center items-center h-96">
                        <div class="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                        <p class="text-slate-500 font-medium">Synchronizing models...</p>
                    </div>
                {:then groupedModels}
                    {#if groupedModels}
                        <div class="p-8 space-y-12">
                            {#each Object.entries(groupedModels) as [provider, models]}
                                <section class="provider-wrapper">
                                    <div class="flex items-center gap-3 mb-6">
                                        <div class="h-8 w-1 bg-[#0098ac] rounded-full"></div>
                                        <h3 class="text-xl font-bold text-slate-800 capitalize tracking-tight">
                                            {provider}
                                        </h3>
                                        <span class="bg-slate-200 text-slate-600 text-xs font-bold px-2 py-0.5 rounded-md">
                                            {models.length}
                                        </span>
                                    </div>
                                    
                                    <div class="bg-slate-100/80 border border-slate-200 rounded-2xl p-6 lg:p-8">
                                        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                            {#each models as model}
                                                <div class="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                                                    <div class="flex justify-between items-start mb-4">
                                                        <h4 class="font-bold text-slate-900 text-lg">{model.model}</h4>
                                                        <span 
                                                        class="text-[10px] uppercase tracking-widest px-2 py-1 text-white rounded font-bold 
                                                            {model.quality === 'Base' ? 'bg-[#00A8B4]' : 
                                                            model.quality === 'Advanced' ? 'bg-[#8EE000]' : 
                                                            model.quality === 'Pro' ? 'bg-[#DF9500]' : 'bg-slate-900'}"
                                                        >
                                                            {model.quality}
                                                        </span>
                                                    </div>
                                                    
                                                    <div class="flex items-center text-sm text-slate-500 mb-6">
                                                        <svg class="w-4 h-4 mr-1.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                                        <span>{model.maxContext.toLocaleString()} tokens context</span>
                                                    </div>
                                                    
                                                    <div class="pt-4 border-t border-slate-100">
                                                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Core Capabilities</p>
                                                        <div class="flex flex-wrap gap-1.5">
                                                            {#each model.capabilities as cap}
                                                                <span class="text-xs px-2.5 py-1 capabilities-list rounded-md border border-blue-100 font-medium capitalize">
                                                                    {cap}
                                                                </span>
                                                            {/each}
                                                        </div>
                                                    </div>
                                                </div>
                                            {/each}
                                        </div>
                                    </div>
                                </section>
                            {/each}
                        </div>
                    {/if}
                {:catch error}
                    <div class="m-8 p-6 bg-red-50 border border-red-100 rounded-xl flex items-center gap-4">
                        <div class="text-red-500 text-2xl">⚠️</div>
                        <div>
                            <p class="text-red-800 font-bold">Connection Error</p>
                            <p class="text-red-600 text-sm">Unable to fetch the model registry. Check your network or API config.</p>
                        </div>
                    </div>
                {/await}
            </div>
        </div>
    </main>
</div>

<style>
    /* Your existing CSS remains untouched */
    :root {
        --input-form-max-width: 768px;
        --primary-blue: #4285f4;
        --primary-blue-dark: #357ae8;
        --text-color-light: #fefefe;
        --text-color-dark: #333;
        --border-color: #e0e0e0;
        --shadow-light: 0 2px 10px rgba(0, 0, 0, 0.08);
        --shadow-medium: 0 4px 20px rgba(0, 0, 0, 0.1);
        --user-message-bg: #f0f4f9;
        --ai-message-bg: #e6f0ff;
        --ai-message-border: #005188;
        --user-message-border: #0098ac;
    }

.app-container {
        display: flex;
        min-height: 100vh;
        height: 100vh;
        overflow: hidden;
    }

    .capabilities-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        color: var(--ai-message-border);
        background-color: var(--ai-message-bg);
    }

    .main-content {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        padding: 40px;
        overflow-y: auto;
    }

    .dashboard-container {
        width: 100%;
        max-width: 1400px;
        margin: 0 auto;
    }

    .portal {
        width: 100%;
        background-color: white;
        border-radius: 1.5rem;
        border: 1px solid #e2e8f0;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
        min-height: 600px;
    }

    /* Modern scrollbar */
    .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 10px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
    }
</style>