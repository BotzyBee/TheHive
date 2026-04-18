<script>
	import "../app.css";
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
    import { initSocket, socketStore } from '$lib/code/agentChat/socketStore.js';
    
    onMount(() => {
        if (browser) {
			const backendUrl = import.meta.env.VITE_BACKEND_DOMAIN || 'http://localhost:3000';
            const socket = initSocket(backendUrl); 
            socket.connect();
            return () => {
                socket.disconnect(); 
            };
        }
    });
</script>
<slot />
