<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import LayoutCombine from '$lib/componants/layoutCombine.svelte';
    import BotzyLogo from '$lib/BotzyAI_Logo.png';
    //import Foot from '$lib/componants/foot.svelte';
    import { invoke } from "@tauri-apps/api/core";

    async function openN8NWindow() {
        try {
            await invoke("open_n8n_window");
        } catch (error) {
            console.error("Failed to open window:", error);
        }
    }

    // Navigation data for the grid layout
    const navLinks = [
        { name: 'Use Agent', href: '/agents', desc: 'Interact with your AI workforce' },
        { name: 'Talk to Botzy', href: '/speech', desc: 'Voice-activated assistance' },
        { name: 'Direct to Provider', href: '/directToModel', desc: 'Message providers (no-agent)' },
        { name: 'Dashboard', href: '/dashboard', desc: 'Analytics and overview' },
    ];
</script>

<svelte:head>
    <title>The Hive : Botzy Bee</title>
</svelte:head>

<LayoutCombine>
    <span slot="head">
    </span>
    <span slot="body" class="pb-4"> 

        <div class="flex justify-center items-center mt-[5vh] w-full">
            <div class="flex flex-col lg:flex-row justify-center items-start w-full">
                
                <div class="flex-1 p-3 flex justify-center lg:items-start lg:mt-[10vh] mx-auto">
                    <img src={BotzyLogo} alt="Botzy Logo" width="300px" class="drop-shadow-2xl hover:scale-105 transition-transform duration-500 ease-out" />
                </div>
                
                <div class="w-full lg:w-2/3 max-w-4xl p-8 lg:mr-10 mx-auto rounded-2xl shadow-2xl border border-white/10 backdrop-blur-md custom-min-height flex flex-col" 
                     style="background-color: rgba(30, 30, 30, 0.4);">
                    
                    <div class="mb-8">
                        <p class="font-black text-4xl lg:text-5xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-green-300 via-blue-400 to-purple-500 drop-shadow-sm">
                            The Hive
                        </p>
                        <p class="text-blue-200/60 text-sm mt-2 uppercase tracking-widest font-semibold">
                            AI Agents for Everyone
                        </p>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 flex-grow">
                        {#each navLinks as link}
                            <a href={link.href} 
                               class="group flex flex-col p-5 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-blue-400/50 transition-all duration-300 ease-out shadow-sm">
                                <span class="text-white font-bold text-lg group-hover:text-blue-300 transition-colors">
                                    {link.name}
                                </span>
                                <span class="text-gray-400 text-sm mt-1 leading-relaxed">
                                    {link.desc}
                                </span>
                            </a>
                        {/each}
                    </div>

					<div class="border-t border-white/5 mt-auto">
						<div class="flex flex-col items-center">
							<span class="text-[10px] text-blue-300/40 uppercase tracking-[0.2em] mb-4 font-bold">
								Developer Tools
							</span>

							<button 
								on:click={openN8NWindow}
								class="group relative px-8 py-3 rounded-xl overflow-hidden
									border border-blue-400/30 bg-blue-400/5
									hover:bg-blue-400/10 hover:border-blue-400/60
									transition-all duration-300 ease-in-out">
								
								<div class="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-blue-500/0 
											translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
								
								<div class="relative flex items-center gap-1">
									<span class="text-white group-hover:text-blue-100 font-medium tracking-wide text-sm transition-colors">
										Open n8n Workspace
									</span>
									
									<svg xmlns="http://www.w3.org/2000/svg" 
										class="text-blue-400/50 group-hover:text-blue-300 transition-colors"
										width="16" height="16" viewBox="0 0 24 24" fill="none" 
										stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
										<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
									</svg>
								</div>
							</button>
						</div>
					</div>
                    
                </div>
            </div>
        </div>
    </span>

    </LayoutCombine>

<style>
    .custom-min-height {
        min-height: 55vh;
    }

    @media (min-width: 1024px) { /* This matches Tailwind's 'lg' breakpoint */
        .custom-min-height {
            min-height: 80vh;
        }
    }
</style>