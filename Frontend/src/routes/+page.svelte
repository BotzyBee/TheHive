<script>
	import { onMount, onDestroy } from 'svelte';
    import LayoutCombine from '$lib/componants/layoutCombine.svelte';
	import BotzyLogo from   '$lib/BotzyAI_Logo.png';
	//import Foot from '$lib/componants/foot.svelte';
</script>

<svelte:head>
	<title>The Hive : Botzy Bee</title>
</svelte:head>

<LayoutCombine>
	<span slot="head">
	</span>
	<span slot="body" class="pb-4"> 

		<div class="flex justify-center items-center mt-[10vh] w-full">
			<div class="flex flex-col lg:flex-row justify-center items-start">
				<!-- Left/ Top Content -->
				<div class="flex-1 p-3 flex justify-center lg:items-start lg:mt-[10vh] mx-auto">
					<img src={BotzyLogo} alt="Botzy Logo" width="300px" />
				</div>
				<!-- Right/ 2nd Content -->
				<div class="w-full lg:w-2/3 max-w-4xl p-3 lg:mr-10 mx-auto bg-white shadow-lg rounded-lg custom-min-height" style="background-color: rgba(100,100,100,0.13);">
					<!-- Head Text Coloured -->
					<p class="font-bold text-4xl
					bg-clip-text text-transparent 
					bg-gradient-to-r from-green-200 to-blue-300 p-5
					drop-shadow-md
					">
						The Hive : AI Assistant
					</p>
					<p style="padding-top: 20px;">	
					<a href="/task"><span class="p-5">TASKS</span></a>
					<a href="/dashboard"><span class="p-5">DASHBOARD</span></a>
					</p>
				</div>
			</div>
		</div>
	</span>

	<!-- <span slot="foot">
		<Foot/>
	</span> -->
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
