<script>
	import "../app.css";
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
    import { socketRoutes, sockets } from "$lib/code/Stores/socketStore";

    
    onMount(() => {
        if (browser) {
            // Setup / Connect all socket routes.
            for(let i=0; i<socketRoutes.length ?? 0; i++){
                console.log("Setting Up : ", socketRoutes[i])
                const chatSocket = sockets[socketRoutes[i]];
                chatSocket.connect();
            }
        }
    });
</script>
<slot />
