<script>
    import { onMount, onDestroy } from 'svelte';
    import { sockets } from '$lib/code/Stores/socketStore.js';
  import { goto } from '$app/navigation';

    const NS = '/chat_botzy';

    let mediaRecorder;
    let isRecording    = false;
    let isTranscribing = false;
    let finalTranscripts = [];
    let audioElement;
    let currentSocket = null;
    let unsubscribeSocket;
    let isConnected = false;
    let detectedMimeType = 'audio/webm;codecs=opus';

    // ── Socket connect/disconnect ────────────────────────────────────────────
    function onConnect() {
        console.log(`[${NS}] Socket connected`);
        isConnected = true;
    }

    function onDisconnect() {
        console.log(`[${NS}] Socket disconnected`);
        isConnected = false;
        if (isRecording) stopRecording();
    }

    // ── Incoming message handler ─────────────────────────────────────────────
    function handleSocketMessage(message) {
        try {
            const parsed = typeof message === 'string' ? JSON.parse(message) : message;
            switch (parsed.type) {
                case 'final':
                    isTranscribing = false;
                    if (parsed.text) finalTranscripts = [...finalTranscripts, parsed.text];
                    break;
                case 'error':
                    isTranscribing = false;
                    console.error('[STT] Server error:', parsed.error);
                    break;
                default:
                    break;
            }
        } catch (err) {
            console.error('[STT] Failed to parse socket message:', err, message);
        }
    }

    function handleAudioStream(data) {
        const blob = data instanceof Blob ? data : new Blob([data], { type: 'audio/mp3' });
        playAudioBlob(blob);
    }

    // ── Mount ────────────────────────────────────────────────────────────────
    onMount(() => {
        sockets[NS].connect();
        unsubscribeSocket = sockets[NS].subscribe(socket => {
            if (socket && socket !== currentSocket) {
                if (currentSocket) {
                    currentSocket.off('connect',      onConnect);
                    currentSocket.off('disconnect',   onDisconnect);
                    currentSocket.off('message',      handleSocketMessage);
                    currentSocket.off('audio_stream', handleAudioStream);
                }
                currentSocket = socket;
                currentSocket.on('connect',      onConnect);
                currentSocket.on('disconnect',   onDisconnect);
                currentSocket.on('message',      handleSocketMessage);
                currentSocket.on('audio_stream', handleAudioStream);
                if (currentSocket.connected) onConnect();
            }
        });
    });

    onDestroy(() => {
        if (unsubscribeSocket) unsubscribeSocket();
        if (currentSocket) {
            currentSocket.off('connect',      onConnect);
            currentSocket.off('disconnect',   onDisconnect);
            currentSocket.off('message',      handleSocketMessage);
            currentSocket.off('audio_stream', handleAudioStream);
        }
        if (isRecording) stopRecording();
    });

    // ── Press-to-talk handlers ───────────────────────────────────────────────
    // mousedown / touchstart → start recording
    // mouseup / mouseleave / touchend → stop recording
    // We guard against double-starts and double-stops with isRecording.

    async function startRecording() {
        if (isRecording || isTranscribing || !isConnected) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                detectedMimeType = 'audio/webm;codecs=opus';
            } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
                detectedMimeType = 'audio/ogg;codecs=opus';
            } else {
                detectedMimeType = '';
            }

            const options = detectedMimeType ? { mimeType: detectedMimeType } : {};
            mediaRecorder = new MediaRecorder(stream, options);

            sockets[NS].send('recording_start', { mimeType: detectedMimeType });

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0 && isConnected && currentSocket?.connected) {
                    sockets[NS].send('audio_chunk', event.data);
                }
            };

            mediaRecorder.start(250);
            isRecording = true;
        } catch (err) {
            console.error('[STT] Microphone access denied:', err);
        }
    }

    function stopRecording() {
        if (!isRecording) return;

        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
        isRecording = false;

        if (currentSocket?.connected) {
            isTranscribing = true;
            sockets[NS].send('recording_stop', {});
        }
    }

    function playAudioBlob(blob) {
        const audioUrl = URL.createObjectURL(blob);
        audioElement.src = audioUrl;
        audioElement.play().catch(err => console.error('[TTS] Playback failed:', err));
        audioElement.onended = () => URL.revokeObjectURL(audioUrl);
    }

    function clearTranscripts() {
        finalTranscripts = [];
    }
</script>

<main class="container">
    <header>
        <h1>Speech Interface</h1>
        <p class="status">
            Status:
            <span class="status-indicator" class:connected={isConnected}>
                {isConnected ? 'Connected' : 'Disconnected'}
            </span>
        </p>
    </header>

    <section class="controls">
        <!--
            Press-to-talk button.
            - mousedown/touchstart  → start recording
            - mouseup/touchend      → stop recording
            - mouseleave            → stop if the cursor drifts off while held
            - preventDefault on touchstart stops the 300ms mobile tap delay
              and prevents the ghost mousedown that would fire after touchend.
        -->
        <button
            class="btn"
            on:click={()=>{goto('./')}}
        >
            Go Back
        </button>
        <button
            class="btn btn-ptt"
            class:recording={isRecording}
            class:transcribing={isTranscribing}
            disabled={!isConnected || isTranscribing}
            on:mousedown={startRecording}
            on:mouseup={stopRecording}
            on:mouseleave={stopRecording}
            on:touchstart|preventDefault={startRecording}
            on:touchend|preventDefault={stopRecording}
        >
            {#if isTranscribing}
                ⏳ Transcribing…
            {:else if isRecording}
                🔴 Recording…
            {:else}
                🎙 Hold to Speak
            {/if}
        </button>

        <button
            on:click={clearTranscripts}
            disabled={finalTranscripts.length === 0}
            class="btn btn-secondary"
        >
            Clear
        </button>
    </section>

    <section class="transcripts">
        <h2>Transcripts</h2>
        <div class="log">
            {#if isTranscribing}
                <p class="partial"><em>Transcribing…</em></p>
            {:else if finalTranscripts.length === 0}
                <p class="empty">No transcripts yet. Hold the button to speak.</p>
            {/if}
            {#each finalTranscripts as text}
                <p class="final"><strong>You:</strong> {text}</p>
            {/each}
        </div>
    </section>

    <audio bind:this={audioElement} style="display: none;"></audio>
</main>

<style>
    .container {
        max-width: 640px;
        margin: 2rem auto;
        padding: 0 1rem;
        font-family: system-ui, -apple-system, sans-serif;
    }
    header { margin-bottom: 1.5rem; }
    h1 { margin: 0 0 0.25rem; }
    .status { margin: 0; font-size: 0.9rem; color: #555; }
    .status-indicator { font-weight: bold; color: red; }
    .status-indicator.connected { color: green; }

    .controls {
        display: flex;
        gap: 0.75rem;
        margin-bottom: 1.5rem;
        flex-wrap: wrap;
        align-items: center;
    }

    .btn {
        padding: 0.65rem 1.25rem;
        font-size: 0.95rem;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        transition: background 0.1s, transform 0.1s, opacity 0.15s;
        user-select: none;       /* prevent text selection while holding */
        -webkit-user-select: none;
    }
    .btn:disabled { cursor: not-allowed; opacity: 0.45; }

    /* Press-to-talk button — three visual states */
    .btn-ptt {
        background: #2563eb;
        color: #fff;
        min-width: 160px;
    }
    .btn-ptt:not(:disabled):hover {
        background: #1d4ed8;
    }
    /* Held down / actively recording */
    .btn-ptt.recording {
        background: #dc2626;
        transform: scale(0.97);
        box-shadow: 0 0 0 4px rgba(220, 38, 38, 0.25);
    }
    /* Waiting for server response */
    .btn-ptt.transcribing {
        background: #d97706;
        cursor: wait;
    }

    .btn-secondary { background: #e5e7eb; color: #111; }
    .btn-secondary:not(:disabled):hover { background: #d1d5db; }

    .transcripts h2 { margin: 0 0 0.75rem; }
    .log {
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 1rem;
        min-height: 200px;
        max-height: 400px;
        overflow-y: auto;
    }
    .empty  { color: #9ca3af; font-style: italic; margin: 0; }
    .final  { margin: 0.4rem 0; }
    .partial { color: #6b7280; margin: 0.4rem 0; }
</style>