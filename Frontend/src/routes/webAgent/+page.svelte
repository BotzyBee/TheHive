<script>
    import { onMount, onDestroy } from 'svelte';
    import { fly } from 'svelte/transition';
    import { flip } from 'svelte/animate';
    import LayoutCombine from '$lib/componants/layoutCombine.svelte';
    import BotzyLogo from '$lib/BotzyAI_Logo.png';
    import { listen } from '@tauri-apps/api/event';

    let updates = [];
    let unlisten;

    function addStatus(message) {
        const newUpdate = {
            id: crypto.randomUUID(),
            text: message,
            timestamp: new Date().toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit',
                hour12: false 
            })
        };
        
        // We keep 10, but the container height will dictate visibility
        updates = [newUpdate, ...updates].slice(0, 10);
    }
    
    onMount(async () => {
        unlisten = await listen('add-status', (event) => {
            addStatus(event.payload);
        });
    });

    onDestroy(() => {
        // Clean up listeners if needed
        if (unlisten) {
            unlisten();
        }
    });
</script>

<svelte:head>
    <title>The Hive : Botzy Bee</title>
</svelte:head>

<LayoutCombine>
    <span slot="head"></span>
    
    <span slot="body" class="pb-4"> 
        <div class="flex flex-col justify-center items-center mt-[3vh] w-full px-4 overflow-hidden">
            
            <div class="mb-6">
                <img src={BotzyLogo} alt="Botzy Logo" class="w-[200px] md:w-[250px] h-auto" />
            </div>

            <div class="text-center w-full max-w-md">
                {#if updates.length === 0}
                    <div 
                        in:fly={{ y: 10, duration: 500 }} 
                        out:fly={{ y: -10, duration: 300 }}
                    >
                        <p class="text-md md:text-lg font-bold text-gray-800 tracking-tight pt-5">
                            Web Agent Starting... <span class="inline-block animate-bee">🐝</span>
                        </p>
                    </div>
                {:else}
                    <div in:fly={{ y: 20, duration: 600 }}>
                        <p class="text-xs font-bold uppercase tracking-widest text-amber-600 mb-6 flex items-center justify-center gap-2">
                            <span class="relative flex h-2 w-2">
                                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span class="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                            </span>
                            Agent Active
                        </p>
                        
                        <div class="flex flex-col gap-3 h-[55vh] max-h-[500px] overflow-hidden">
                            {#each updates as update, i (update.id)}
                                <div 
                                    animate:flip={{ duration: 400 }}
                                    in:fly={{ y: -30, opacity: 0, duration: 500 }}
                                    class="status-card flex flex-col"
                                    style="opacity: {1 - (i * 0.15)};"
                                >
                                    <span class="text-[9px] font-mono text-amber-600 leading-none">
                                        [{update.timestamp}]
                                    </span>
                                    
                                    <span class="text-xs text-gray-700 font-medium truncate">
                                        {update.text}
                                    </span>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}
            </div>

        </div>
    </span>
</LayoutCombine>

<style>
    .status-card {
        background: white;
        border: 1px solid #f1f1f1;
        padding: 0.75rem 1.25rem;
        border-radius: 12px;
        box-shadow: 0 2px 8px -2px rgba(0, 0, 0, 0.05);
        display: flex;
        align-items: center;
        flex-shrink: 0; /* Prevents cards from squishing vertically */
        width: 100%;
        box-sizing: border-box;
    }

    .animate-bee {
        animation: rotate-bee 2s linear infinite;
        font-size: x-large;
    }

    @keyframes rotate-bee {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
</style>