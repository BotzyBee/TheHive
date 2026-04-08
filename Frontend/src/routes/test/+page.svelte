<script>
	import { fade, fly, slide } from 'svelte/transition';

	// State Management
	let textInput = '';
	let passwordInput = '';
	let numberInput = 0;
	let dateInput = '';
	let activeTab = 'tab1';
	let isModalOpen = false;
	let checkboxStatus = false;
	let rangeValue = 50;
	let selectedRadio = '';
	let selectedDropdown = '';
	let isToggled = false;
	let isSubmitting = false;
	
	// Toast Logic
	let toastMessage = '';
	let showToast = false;

	const toggleModal = () => {
		isModalOpen = !isModalOpen;
		if (isModalOpen) triggerToast("Modal Opened");
	};

	function triggerToast(msg) {
		toastMessage = msg;
		showToast = true;
		setTimeout(() => { showToast = false; }, 3000);
	}

	function handleSubmit() {
		isSubmitting = true;
		setTimeout(() => {
			isSubmitting = false;
			triggerToast("Form submitted successfully!");
		}, 1500);
	}
</script>

<main class="p-8 bg-slate-50 min-h-[300vh] font-sans text-slate-950 pb-24">
	<header id="top" class="mb-12 border-b-4 border-indigo-600 pb-8">
		<h1 id="main-header" class="text-6xl font-black mb-4 text-indigo-900 tracking-tighter uppercase">The Hive - AI Hell Page</h1>
		<p class="text-xl text-slate-600 max-w-3xl">
			This is a stress-test page for automated agents. It is intentionally long, containing nested elements, 
			dynamic states, and various interaction patterns.
		</p>
	</header>

	<div class="space-y-16 max-w-7xl mx-auto">
		
		<section id="form-section" class="bg-white p-10 rounded-3xl shadow-xl border border-slate-200">
			<h2 class="text-3xl font-bold mb-8 flex items-center gap-3">
				<span class="p-2 bg-indigo-100 text-indigo-600 rounded-lg">01</span>
				Comprehensive Form Controls
			</h2>
			
			<form on:submit|preventDefault={handleSubmit} class="grid grid-cols-1 md:grid-cols-2 gap-8">
				<div class="space-y-4">
					<div>
						<label for="text-input" class="block text-sm font-black uppercase text-slate-500 mb-1">Text Field</label>
						<input type="text" id="text-input" bind:value={textInput} placeholder="Input characters..." class="w-full border-2 p-3 rounded-xl focus:ring-4 focus:ring-indigo-200 outline-none transition-all" />
					</div>

					<div>
						<label for="password-input" class="block text-sm font-black uppercase text-slate-500 mb-1">Password Field</label>
						<input type="password" id="password-input" bind:value={passwordInput} class="w-full border-2 p-3 rounded-xl focus:border-indigo-500 outline-none" />
					</div>

					<div class="grid grid-cols-2 gap-4">
						<div>
							<label for="number-input" class="block text-sm font-black uppercase text-slate-500 mb-1">Number</label>
							<input type="number" id="number-input" bind:value={numberInput} class="w-full border-2 p-3 rounded-xl" />
						</div>
						<div>
							<label for="date-picker" class="block text-sm font-black uppercase text-slate-500 mb-1">Date</label>
							<input type="date" id="date-picker" bind:value={dateInput} class="w-full border-2 p-3 rounded-xl" />
						</div>
					</div>
				</div>

				<div class="space-y-6">
					<div class="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
						<div>
							<span class="block font-bold text-slate-800">Advanced Logic Toggle</span>
							<span class="text-xs text-slate-500">Tests custom role="switch" buttons</span>
						</div>
						<button 
							type="button"
							id="toggle-switch"
							role="switch"
							aria-checked={isToggled}
							on:click={() => { isToggled = !isToggled; triggerToast(`Toggle is ${isToggled ? 'Active' : 'Inactive'}`); }}
							class="{isToggled ? 'bg-emerald-500' : 'bg-slate-300'} relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:ring-4 focus:ring-emerald-200"
						>
							<span class="{isToggled ? 'translate-x-7' : 'translate-x-1'} inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform" />
						</button>
					</div>

					<div class="flex flex-col gap-3">
						<label class="font-black uppercase text-xs text-slate-500">Radio Group</label>
						<div class="flex gap-4">
							<label class="flex items-center gap-2 cursor-pointer">
								<input type="radio" name="test-radio" value="opt-a" bind:group={selectedRadio} class="w-5 h-5 text-indigo-600" /> 
								<span>Option Alpha</span>
							</label>
							<label class="flex items-center gap-2 cursor-pointer">
								<input type="radio" name="test-radio" value="opt-b" bind:group={selectedRadio} class="w-5 h-5 text-indigo-600" /> 
								<span>Option Beta</span>
							</label>
						</div>
					</div>

					<div>
						<label for="dropdown" class="block text-sm font-black uppercase text-slate-500 mb-1">Selection Dropdown</label>
						<select id="dropdown" bind:value={selectedDropdown} class="w-full border-2 p-3 rounded-xl appearance-none bg-white">
							<option value="">-- Please Select --</option>
							<option value="val-1">Automated Option 1</option>
							<option value="val-2">Automated Option 2</option>
							<option value="val-3">Automated Option 3</option>
						</select>
					</div>
				</div>

				<div class="md:col-span-2 pt-4">
					<label class="flex items-center space-x-3 cursor-pointer mb-6">
						<input type="checkbox" id="test-checkbox" bind:checked={checkboxStatus} class="h-6 w-6 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
						<span class="text-slate-700 font-medium">I confirm that I am an automated WebDriver agent ready for testing.</span>
					</label>

					<button 
						type="submit" 
						id="submit-btn"
						disabled={isSubmitting}
						class="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl hover:bg-indigo-700 active:scale-[0.99] transition-all disabled:opacity-50 shadow-lg shadow-indigo-200"
					>
						{#if isSubmitting}
							<span id="loader" class="flex items-center justify-center gap-3">
								<svg class="animate-spin h-6 w-6 text-white" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
								Processing Submission...
							</span>
						{:else}
							Submit All Form Data
						{/if}
					</button>
				</div>
			</form>
		</section>

		<section id="interactive-section" class="grid grid-cols-1 lg:grid-cols-2 gap-10">
			<div class="bg-white p-10 rounded-3xl shadow-xl border border-slate-200">
				<h2 class="text-2xl font-bold mb-6">Action & Feedback</h2>
				<div class="flex flex-wrap gap-4 mb-10">
					<button id="standard-btn" on:click={() => triggerToast("Standard Click")} class="bg-slate-100 px-6 py-3 rounded-xl font-bold hover:bg-slate-200">Standard Button</button>
					<button id="disabled-btn" disabled class="bg-slate-50 text-slate-300 px-6 py-3 rounded-xl cursor-not-allowed">Disabled Button</button>
					<button id="modal-trigger" on:click={toggleModal} class="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-600 transition-colors">Open Dialogue</button>
				</div>

				<div class="mb-8">
					<label for="range-slider" class="block text-sm font-bold text-slate-500 mb-4 tracking-widest">INTENSITY SLIDER: <span id="range-val" class="text-indigo-600 text-xl">{rangeValue}</span></label>
					<input type="range" id="range-slider" bind:value={rangeValue} class="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
				</div>
			</div>

			<div class="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col">
				<div class="flex bg-slate-100">
					<button id="tab-1-btn" class="flex-1 py-4 font-black uppercase text-sm tracking-widest transition-all {activeTab === 'tab1' ? 'bg-white text-indigo-600 border-b-4 border-indigo-600' : 'text-slate-400'}" on:click={() => activeTab = 'tab1'}>Section Alpha</button>
					<button id="tab-2-btn" class="flex-1 py-4 font-black uppercase text-sm tracking-widest transition-all {activeTab === 'tab2' ? 'bg-white text-indigo-600 border-b-4 border-indigo-600' : 'text-slate-400'}" on:click={() => activeTab = 'tab2'}>Section Beta</button>
				</div>
				<div class="p-8 flex-grow">
					{#if activeTab === 'tab1'}
						<div id="content-alpha" in:fade>
							<h3 class="text-xl font-bold mb-2">Alpha Stream</h3>
							<p class="text-slate-600 leading-relaxed">
								Lorem ipsum dolor sit amet, consectetur adipiscing elit. Svelte's transition will make this fade in, testing your agent's ability to wait for element visibility.
							</p>
						</div>
					{:else}
						<div id="content-beta" in:fly={{ x: 20 }}>
							<h3 class="text-xl font-bold mb-2 text-indigo-600">Beta Channel</h3>
							<p class="text-slate-600 leading-relaxed">
								Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. This content was flown in from the right.
							</p>
						</div>
					{/if}
				</div>
			</div>
		</section>

		<section class="grid grid-cols-1 lg:grid-cols-3 gap-10">
			<div class="lg:col-span-2 bg-white p-10 rounded-3xl shadow-xl border border-slate-200">
				<h2 class="text-2xl font-bold mb-6">Tabular Data & Lists</h2>
				<table class="w-full text-left border-collapse mb-8" id="test-table">
					<thead>
						<tr class="bg-slate-50 border-b-2 border-slate-200">
							<th class="p-4 font-black uppercase text-xs text-slate-500">System ID</th>
							<th class="p-4 font-black uppercase text-xs text-slate-500">User Entity</th>
							<th class="p-4 font-black uppercase text-xs text-slate-500">Access Role</th>
							<th class="p-4 font-black uppercase text-xs text-slate-500">Status</th>
						</tr>
					</thead>
					<tbody>
						<tr class="border-b hover:bg-slate-50">
							<td class="p-4 font-mono">#001</td>
							<td class="p-4 font-bold">John Doe</td>
							<td class="p-4">Administrator</td>
							<td class="p-4 text-emerald-600 font-bold">Active</td>
						</tr>
						<tr class="border-b hover:bg-slate-50">
							<td class="p-4 font-mono">#002</td>
							<td class="p-4 font-bold">Jane Smith</td>
							<td class="p-4">Content Editor</td>
							<td class="p-4 text-amber-600 font-bold">Pending</td>
						</tr>
					</tbody>
				</table>

				<ul id="unordered-list" class="space-y-2 list-none">
					<li class="flex items-center gap-2">
						<span class="w-2 h-2 bg-indigo-500 rounded-full"></span> 
						Deep Link List Item One
					</li>
					<li class="flex items-center gap-2">
						<span class="w-2 h-2 bg-indigo-500 rounded-full"></span> 
						Deep Link List Item Two
					</li>
				</ul>
			</div>

			<div class="bg-white p-8 rounded-3xl shadow-xl border border-slate-200">
				<h2 class="text-2xl font-bold mb-6">Asset Verification</h2>
				<div class="space-y-6">
					<div>
						<span class="text-xs font-black text-slate-400 uppercase block mb-2">Valid Image Asset</span>
						<img id="test-image-valid" src="https://picsum.photos/id/237/400/300" alt="Test Black Dog" class="rounded-2xl w-full border border-slate-200 shadow-sm" />
					</div>
					<div>
						<span class="text-xs font-black text-slate-400 uppercase block mb-2">Broken Image Asset</span>
						<img id="test-image-broken" src="https://invalid-source-url-404.com/notfound.jpg" alt="Broken Link Display" class="rounded-2xl w-full h-32 bg-red-50 border border-red-100" />
					</div>
				</div>
			</div>
		</section>

		<section id="text-section" class="bg-white p-12 rounded-3xl shadow-xl border border-slate-200">
			<h2 class="text-3xl font-bold mb-10 border-b pb-4 text-slate-900">Text Content & DOM Depth</h2>
			
			<div class="grid grid-cols-1 md:grid-cols-2 gap-12 text-slate-700 leading-relaxed">
				<div class="space-y-6">
					<h3 id="h3-test" class="text-2xl font-bold text-indigo-800">Heading Level Three Content</h3>
					<p id="lorem-1">
						Lorem ipsum dolor sit amet, <strong>consectetur adipiscing elit</strong>. Vestibulum in vehicula purus. Quisque vel lectus nec elit condimentum vestibulum. 
						Cras id pretium magna. Sed sodales, purus a bibendum varius, elit orci hendrerit dolor, vel consequat sapien neque vel ex.
					</p>
					<p id="lorem-2">
						Nullam aliquet nisl ac nisl feugiat, sit amet tincidunt tortor scelerisque. Curabitur sed massa sit amet enim hendrerit elementum. 
						Mauris quis libero sodales, tincidunt ante eu, efficitur turpis.
					</p>
					<code id="code-snippet" class="block p-5 bg-slate-900 text-emerald-400 rounded-xl font-mono text-sm overflow-x-auto">
						document.querySelector('#main-header').innerText = "SUCCESS";
					</code>
				</div>

				<div class="space-y-6">
					<h4 id="h4-test" class="text-xl font-bold text-slate-500 uppercase tracking-widest">Metadata Subheading</h4>
					<p id="lorem-3" class="text-justify italic border-l-8 border-indigo-100 pl-6 py-2">
						"At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident."
					</p>
					<div class="flex flex-col gap-4">
						<a href="#top" id="internal-jump" class="text-indigo-600 font-black underline decoration-2 underline-offset-4">Back to Top (Jump Link)</a>
						<a href="https://example.com" target="_blank" id="external-link" class="text-indigo-600 font-black underline decoration-2 underline-offset-4">External Resource Link ↗</a>
					</div>
					<blockquote id="test-quote" class="p-6 bg-slate-50 rounded-2xl text-slate-500 italic">
						"An automated tester walks into a bar. Orders a beer. Orders 0 beers. Orders 99999999999 beers. Orders a lizard. Orders -1 beers."
					</blockquote>
				</div>
			</div>
		</section>

		<section class="bg-slate-200 p-10 rounded-3xl border-2 border-slate-300 opacity-50">
			<h2 class="text-2xl font-bold mb-4">Tricky Elements Zone</h2>
			<p class="mb-6">The following elements are present in the DOM but may be hidden from view.</p>
			<div id="hidden-element" class="hidden">This element has display: none.</div>
			<div id="opacity-zero" class="opacity-0">This element is present but has zero opacity.</div>
			<div id="visibility-hidden" class="invisible">This element has visibility: hidden.</div>
		</section>

	</div>

	{#if showToast}
		<div 
			id="toast-container" 
			transition:fly={{ y: 100, duration: 400 }}
			class="fixed bottom-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-10 py-5 rounded-3xl shadow-2xl flex items-center gap-5 z-[200] border border-slate-700"
		>
			<div class="w-4 h-4 bg-indigo-400 rounded-full animate-ping"></div>
			<span id="toast-text" class="text-lg font-black tracking-wide">{toastMessage}</span>
		</div>
	{/if}

	{#if isModalOpen}
		<div 
			id="modal-overlay" 
			class="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[150] p-6"
			on:click|self={toggleModal}
		>
			<div 
				id="modal-content"
				class="bg-white p-12 rounded-[3rem] max-w-xl w-full shadow-2xl relative border border-white/20"
				in:fly={{ y: 50, duration: 400 }}
			>
				<h3 class="text-4xl font-black text-slate-900 mb-6 tracking-tighter">Dialogue Active</h3>
				<p class="text-slate-600 mb-10 text-lg leading-relaxed">
					Your WebDriver agent successfully triggered the modal. This window blocks the main content. 
					Interact with the buttons below to clear the state.
				</p>
				<div class="grid grid-cols-2 gap-4">
					<button 
						id="confirm-modal-btn" 
						on:click={() => { triggerToast("Modal Action Confirmed"); isModalOpen = false; }} 
						class="bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-indigo-700"
					>
						Confirm
					</button>
					<button 
						id="close-modal" 
						on:click={toggleModal} 
						class="bg-slate-100 text-slate-900 py-4 rounded-2xl font-black text-lg hover:bg-slate-200"
					>
						Dismiss
					</button>
				</div>
			</div>
		</div>
	{/if}

	<footer class="mt-20 py-12 text-center text-slate-400 border-t border-slate-200">
		<p class="font-bold tracking-widest uppercase text-xs">End of Testing Environment &bull; Automated Sandbox 2026</p>
	</footer>
</main>

<style>
	:global(html) {
		scroll-behavior: smooth;
	}
	
	/* Highlighting focus for accessibility/automation testing */
	input:focus, select:focus, textarea:focus {
		border-color: #4f46e5;
		box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.1);
	}

	#modal-overlay { cursor: crosshair; }
	#modal-content { cursor: default; }
</style>