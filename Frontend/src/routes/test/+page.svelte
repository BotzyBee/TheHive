<script>
  import { onMount, onDestroy } from 'svelte';
  import { listen } from '@tauri-apps/api/event';
  import { invoke } from '@tauri-apps/api/core';

  let messages = [];
  let unlisten;
  let unlisten2;

  // These are your "state" variables bound to the inputs
  let inputEvent = ""; 
  let inputPayload = "";
    let inputEvent2 = ""; 
  let inputPayload2 = "";

  onMount(async () => {
    unlisten = await listen('test-message', (event) => {
      messages = [...messages, event.payload];
    });
    unlisten2 = await listen('testing', (event) => {
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
      inputEvent2 = "";
      inputPayload2 = "";
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

    <div style="padding-top: 30px;">
    <input bind:value={inputEvent2} placeholder="EVENT.." />
    <input bind:value={inputPayload2} placeholder="Payload..." />
    <button on:click={() => sendMessageToServer("relay", JSON.stringify({event: inputEvent2, payload: inputPayload2}))}>
      Relay Call
    </button>
    </div>

  <ul>
    {#each messages as msg}
      <li>{msg}</li>
    {/each}
  </ul>
</main>