<script>
  import { onMount, onDestroy } from 'svelte';
  import { listen } from '@tauri-apps/api/event';
  import { invoke } from '@tauri-apps/api/core';

  let messages = [];
  let unlisten;

  // These are your "state" variables bound to the inputs
  let inputEvent = ""; 
  let inputPayload = "";

  onMount(async () => {
    unlisten = await listen('test-message', (event) => {
      messages = [...messages, event.payload];
    });
  });

  onDestroy(() => {
    if (unlisten) unlisten();
    if (unlisten2) unlisten2();
  });

  // Renamed parameters to 'ev' and 'pl' to avoid shadowing imports
  async function sendMessageToServer(ev, pl) {
    console.log("Sending to Rust:", { ev, pl });
    try {
      await invoke('send_to_express', { 
        event: ev, 
        payload: pl
      });
      console.log("Sent to Rust!");
      
      // Clear the inputs
      inputEvent = "";
      inputPayload = "";
    } catch (err) {
      console.error("Failed to send:", err);
    }
  }
</script>

<main>
  <h1>The Hive Console 🐝</h1>
    <input bind:value={inputEvent} placeholder="EVENT.." />
    <input bind:value={inputPayload} placeholder="Payload..." />
    <button on:click={() => sendMessageToServer(inputEvent, inputPayload)}>
      Send to Express
    </button>

  <ul>
    {#each messages as msg}
      <li>{msg}</li>
    {/each}
  </ul>
</main>