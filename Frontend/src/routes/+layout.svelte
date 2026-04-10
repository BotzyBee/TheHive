<script>
	import "../app.css";
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
    import { initSocket, socketStore } from '$lib/code/agentChat/socketStore.js';

	// Socket initialization moved to onMount in the layout to ensure it's available globally and only initialized once when the app loads.
    onMount(() => {
        if (browser) {
			console.log("Initializing socket connection...");
			const backendUrl = import.meta.env.VITE_BACKEND_DOMAIN || 'http://localhost:3000';
            const socket = initSocket(backendUrl); 
			console.log("Socket initialized:", socket);
            socket.connect();
            return () => {
                socket.disconnect(); 
            };
        }
    });
</script>
<slot />
