<script>
    import Sidebar from '$lib/componants/Sidebar.svelte';
    import { getModels, updateModels } from '$lib/code/utils.js';
    import { onMount } from 'svelte';
    import { fade, fly } from 'svelte/transition';

    // UI State
    let isSidebarCollapsed = true;
    let isSubmitting = false;
    let groupedModels = {};
    let modelsPromise = new Promise(() => {}); 

    // Toast State
    let toast = { show: false, outcome: 'Success', message: '' };
    function showToast(outcome, message) {
        toast = { show: true, outcome, message };
        setTimeout(() => { toast.show = false; }, 4000);
    }

    // Configuration
    const capabilityOptions = [
        { id: 'text', label: 'Text' },
        { id: 'image', label: 'Image' },
        { id: 'code', label: 'Code' },
        { id: 'textToSpeech', label: 'Text to Speech' },
        { id: 'speechToText', label: 'Speech to Text' },
        { id: 'local', label: 'Runs Locally' },
        { id: 'deepResearch', label: 'Research' },
        { id: 'reasoning', label: 'Reasoning' },
        { id: 'embedding', label: 'Embedding' },
        { id: 'structuredOutputs', label: 'Structured Outputs' },
        { id: 'websearch', label: 'Web Search' },
        { id: 'maps', label: 'Maps' }
    ];

    function getCapabilityLabel(id) {
        return capabilityOptions.find(opt => opt.id === id)?.label || id;
    }

    // Modal State
    let showEditModal = false;
    let showDeleteModal = false;
    let modalMode = 'add'; // 'add' | 'update'
    let currentProvider = '';
    let modelToDelete = null;

    let formData = {
        model: '',
        provider: '',
        capabilities: [],
        maxContext: 128000,
        quality: 'Base',
        active: true
    };

    onMount(() => {
        refreshData();
    });

    function refreshData() {
        modelsPromise = getModels().then(data => {
            groupedModels = data;
            console.log(groupedModels);
            return groupedModels;
        });
    }

    function toggleSidebar() {
        isSidebarCollapsed = !isSidebarCollapsed;
    }

    // --- Make Backend Call ---
    async function makeBackendCall(action, dataPayload) {
        isSubmitting = true;
        let res = await updateModels({action, data: dataPayload});
        isSubmitting = false;
        let message;
        if(res.outcome === 'Success') {
            message = `Model ${dataPayload.model} was ${action}ed successfully.`;
            refreshData();
        } else {
            message = res.message;
        }
        return {
            outcome: res.outcome,
            message: message
        };
    }

    // --- Event Handlers ---
    function openAddModal(provider) {
        modalMode = 'add';
        currentProvider = provider;
        formData = { 
            model: '', 
            provider: provider, 
            capabilities: ['text'], 
            maxContext: 128000, 
            quality: 'Base', 
            active: true 
        };
        showEditModal = true;
    }

    function openEditModal(provider, model) {
        modalMode = 'update';
        currentProvider = provider;
        formData = { ...model, capabilities: [...model.capabilities] };
        showEditModal = true;
    }

    async function handleSave() {
        const response = await makeBackendCall(modalMode, formData);
        showToast(response.outcome, response.message);

        if (response.outcome === 'Success') {
            if (modalMode === 'add') {
                groupedModels[currentProvider] = [...groupedModels[currentProvider], { ...formData }];
            } else {
                const index = groupedModels[currentProvider].findIndex(m => m.model === formData.model);
                groupedModels[currentProvider][index] = { ...formData };
            }
            groupedModels = { ...groupedModels }; // Trigger Svelte reactivity
            showEditModal = false;
        }
    }

    function confirmDeletePrompt(provider, model) {
        modelToDelete = { provider, model };
        showDeleteModal = true;
    }

    async function handleDelete() {
        const response = await makeBackendCall('delete', modelToDelete.model);
        showToast(response.outcome, response.message);

        if (response.outcome === 'Success') {
            groupedModels[modelToDelete.provider] = groupedModels[modelToDelete.provider].filter(
                m => m.model !== modelToDelete.model.model
            );
            groupedModels = { ...groupedModels };
            showDeleteModal = false;
            modelToDelete = null;
        }
    }
</script>

<div class="app-container">
    <Sidebar 
        bind:isSidebarCollapsed={isSidebarCollapsed} 
        on:toggle={toggleSidebar} 
    />

    {#if toast.show}
        <div 
            transition:fly={{ y: -50, duration: 400 }}
            class="fixed top-6 left-1/2 -translate-x-1/2 z-[100] min-w-[300px] shadow-2xl rounded-2xl p-4 flex items-center gap-3 border
            {toast.outcome === 'Success' ? 'bg-white border-emerald-100 text-emerald-800' : 'bg-white border-red-100 text-red-800'}"
        >
            <div class="h-10 w-10 rounded-full flex items-center justify-center shrink-0 
                {toast.outcome === 'Success' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}">
                {#if toast.outcome === 'Success'}
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                {:else}
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                {/if}
            </div>
            <div class="flex flex-col">
                <span class="font-bold text-sm capitalize">{toast.outcome}</span>
                <span class="text-xs opacity-80">{toast.message}</span>
            </div>
        </div>
    {/if}

    <main class="main-content">
        <div class="dashboard-container">
            <div class="mb-6 flex justify-between items-center">
                <h1 class="text-3xl font-bold text-slate-900 tracking-tight">Model Directory</h1>
            </div>

            <div class="portal overflow-y-auto custom-scrollbar">
                {#await modelsPromise}
                    <div class="flex flex-col justify-center items-center h-96">
                        <div class="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                        <p class="text-slate-500 font-medium">Synchronizing Registry...</p>
                    </div>
                {:then groupedModels}
                    <div class="p-8 space-y-12">
                        {#each Object.entries(groupedModels) as [provider, models]}
                            <section>
                                <div class="flex items-center gap-3 mb-6">
                                    <div class="h-8 w-1 bg-[#0098ac] rounded-full"></div>
                                    <h3 class="text-xl font-bold text-slate-800 capitalize">{provider}</h3>
                                    <button 
                                        on:click={() => openAddModal(provider)}
                                        class="ml-auto bg-[#0098ac] hover:bg-[#007b8a] text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm flex items-center gap-2"
                                    >
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
                                        Add Model
                                    </button>
                                </div>
                                
                                <div class="bg-slate-100/80 border border-slate-200 rounded-2xl p-6 lg:p-8">
                                    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                        {#each models as model}
                                            <div class="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all relative group">
                                                
                                                <div class="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button on:click={() => openEditModal(provider, model)} class="p-2 bg-slate-50 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors">
                                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                    </button>
                                                    <button on:click={() => confirmDeletePrompt(provider, model)} class="p-2 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors">
                                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </div>

                                                <div class="flex items-center gap-2 mb-4">
                                                    <div class="w-2.5 h-2.5 rounded-full {model.active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500'}" title={model.active ? 'Active' : 'Inactive'}></div>
                                                    <h4 class="font-bold text-slate-900 text-lg leading-none">{model.model}</h4>
                                                </div>
                                                
                                                <div class="flex items-center justify-between mb-6">
                                                    <div class="flex items-center text-sm text-slate-500">
                                                        <svg class="w-4 h-4 mr-1.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                                        <span>{model.maxContext.toLocaleString()} context</span>
                                                    </div>
                                                    <span class="text-[10px] uppercase tracking-widest px-2 py-1 text-white rounded font-bold 
                                                        {model.quality === 'Base' ? 'bg-[#00A8B4]' : 
                                                        model.quality === 'Advanced' ? 'bg-[#8EE000]' : 
                                                        model.quality === 'Pro' ? 'bg-[#DF9500]' : 'bg-slate-900'}">
                                                        {model.quality}
                                                    </span>
                                                </div>
                                                
                                                <div class="pt-4 border-t border-slate-100">
                                                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Core Capabilities</p>
                                                    <div class="flex flex-wrap gap-1.5">
                                                        {#each model.capabilities as cap}
                                                            <span class="text-[11px] px-2.5 py-1 capabilities-list rounded-md border border-blue-100 font-medium">
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
                {/await}
            </div>
        </div>
    </main>

    {#if showEditModal}
        <div transition:fade={{ duration: 200 }} class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[70] p-4">
            <div 
                transition:fly={{ y: 20, duration: 300 }}
                class="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
                <div class="p-6 border-b flex justify-between items-center bg-slate-50">
                    <h2 class="text-xl font-bold text-slate-800">
                        {modalMode === 'add' ? 'Add New Model' : `Edit ${formData.model}`}
                    </h2>
                    <button on:click={() => showEditModal = false} class="text-slate-400 hover:text-slate-600 transition-colors">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div class="p-8 overflow-y-auto custom-scrollbar space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="space-y-2">
                            <label class="text-sm font-bold text-slate-700">Model Name</label>
                            <input 
                                bind:value={formData.model} 
                                disabled={modalMode === 'update'}
                                placeholder="e.g. gpt-5-nano"
                                class="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#0098ac] outline-none transition-all disabled:bg-slate-100"
                            />
                        </div>
                        <div class="space-y-2">
                            <label class="text-sm font-bold text-slate-700">Max Context</label>
                            <input 
                                type="number"
                                bind:value={formData.maxContext} 
                                class="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#0098ac] outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                        <div class="space-y-2">
                            <label class="text-sm font-bold text-slate-700">Quality Tier</label>
                            <select bind:value={formData.quality} class="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#0098ac] outline-none">
                                <option value="Base">Base</option>
                                <option value="Advanced">Advanced</option>
                                <option value="Pro">Pro</option>
                            </select>
                        </div>
                        <div class="flex items-center gap-3 h-full pt-6">
                            <label class="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" bind:checked={formData.active} class="sr-only peer">
                                <div class="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                <span class="ml-3 text-sm font-bold text-slate-700">Active Status</span>
                            </label>
                        </div>
                    </div>

                    <div class="space-y-3">
                        <label class="text-sm font-bold text-slate-700">Model Capabilities</label>
                        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {#each capabilityOptions as cap}
                                <label class="flex items-center p-3 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-50 transition-all has-[:checked]:bg-blue-50 has-[:checked]:border-blue-200">
                                    <input 
                                        type="checkbox" 
                                        value={cap.label} 
                                        bind:group={formData.capabilities} 
                                        class="w-4 h-4 text-[#0098ac] border-slate-300 rounded focus:ring-[#0098ac]"
                                    >
                                    <span class="ml-3 text-xs font-medium text-slate-600">{cap.label}</span>
                                </label>
                            {/each}
                        </div>
                    </div>
                </div>

                <div class="p-6 border-t bg-slate-50 flex justify-end gap-3">
                    <button on:click={() => showEditModal = false} class="px-6 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors">
                        Cancel
                    </button>
                    <button 
                        on:click={handleSave} 
                        disabled={isSubmitting}
                        class="px-8 py-2 bg-[#0098ac] text-white rounded-xl text-sm font-bold shadow-lg shadow-cyan-900/10 hover:bg-[#007b8a] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    {/if}

    {#if showDeleteModal}
        <div transition:fade={{ duration: 150 }} class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[80] p-4">
            <div transition:fly={{ y: 10, duration: 200 }} class="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center">
                <div class="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <h3 class="text-xl font-bold text-slate-900 mb-2">Delete Model?</h3>
                <p class="text-sm text-slate-500 mb-8">
                    Are you sure you want to delete <span class="font-bold text-slate-800">{modelToDelete?.model.model}</span>? This action cannot be reversed.
                </p>
                <div class="flex gap-3">
                    <button on:click={() => showDeleteModal = false} class="flex-1 px-4 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">
                        Keep it
                    </button>
                    <button 
                        on:click={handleDelete}
                        disabled={isSubmitting}
                        class="flex-1 px-4 py-3 text-sm font-bold bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-900/20 disabled:opacity-50"
                    >
                        {isSubmitting ? 'Deleting...' : 'Confirm Delete'}
                    </button>
                </div>
            </div>
        </div>
    {/if}
</div>

<style>
    :root {
        --user-message-border: #0098ac;
        --ai-message-bg: #e6f0ff;
        --ai-message-border: #005188;
    }

    .app-container {
        display: flex;
        min-height: 100vh;
        height: 100vh;
        overflow: hidden;
    }

    .main-content {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        padding: 40px;
        overflow-y: auto;
        background-color: #f8fafc;
    }

    .dashboard-container {
        width: 100%;
        max-width: 1400px;
        margin: 0 auto;
    }

    .portal {
        width: 100%;
        background-color: white;
        border-radius: 2rem;
        border: 1px solid #e2e8f0;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
        min-height: 600px;
    }

    .capabilities-list {
        color: var(--ai-message-border);
        background-color: var(--ai-message-bg);
    }

    /* Scrollbar */
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