// socketFns.js
import { SpeechService } from './elevenLabs.js';
import { convertToMp3Buffer } from './processAudio.js'; 
import { TestBotzyAgent } from '../main.js';

export async function handleFrontendConnection(socket) {
    let chunks        = [];   // raw WebM/Ogg chunks from the browser
    let isRecording   = false;
    let mimeType      = 'audio/webm;codecs=opus';

    // ── recording_start ──────────────────────────────────────────────────────
    socket.on('recording_start', ({ mimeType: mt } = {}) => {
        console.log(`[STT] recording_start — mimeType: "${mt}"`);
        mimeType    = mt || 'audio/webm;codecs=opus';
        chunks      = [];
        isRecording = true;
    });

    // ── audio_chunk ──────────────────────────────────────────────────────────
    socket.on('audio_chunk', (chunk) => {
        if (!isRecording) {
            // recording_start never arrived — start buffering anyway
            isRecording = true;
        }
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    // ── recording_stop ───────────────────────────────────────────────────────
    socket.on('recording_stop', async () => {
        console.log(`[STT] recording_stop — ${chunks.length} chunks buffered`);
        isRecording = false;

        if (chunks.length === 0) {
            console.warn('[STT] No audio chunks received, skipping transcription');
            return;
        }

        try {
            // 1. Concatenate all raw browser chunks into one buffer
            const rawBuffer = Buffer.concat(chunks);
            chunks = []; // free memory immediately

            // 2. Convert WebM/Ogg → MP3 via FFmpeg
            console.log('[STT] Converting audio to MP3...');
            const format   = mimeToFFmpegFormat(mimeType);
            const mp3Buffer = await convertToMp3Buffer(rawBuffer, format);
            console.log(`[STT] MP3 ready — ${mp3Buffer.length} bytes`);

            // 3. Send to ElevenLabs batch STT
            // if mp3 > X size.. give pre-generated 'working on that..' response.
            console.log('[STT] Sending to ElevenLabs batch transcription...');
            const text = await SpeechService.transcribeFile(mp3Buffer, 'audio/mpeg');
            console.log('[STT] Transcript:', text);

            // 3A. Get AI to answer
            let aiAnswer = await TestBotzyAgent(text);

            // 3B. Test audio generation
            const speechResponse = await SpeechService.generateSpeech(aiAnswer);
            socket.emit('audio_stream', speechResponse);

            // 4. Emit the final transcript to the frontend
            socket.emit('message', { type: 'final', text });

        } catch (err) {
            console.error('[STT] Transcription failed:', err);
            socket.emit('message', { type: 'error', error: 'Transcription failed' });
        }
    });

    // ── disconnect ───────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
        console.log('[STT] Client disconnected — clearing buffer');
        chunks      = [];
        isRecording = false;
    });

    // ── helpers ──────────────────────────────────────────────────────────────
    function mimeToFFmpegFormat(mt = '') {
        if (mt.includes('ogg'))  return 'ogg';
        if (mt.includes('mp4'))  return 'mp4';
        if (mt.includes('webm')) return 'webm';
        return 'webm';
    }
}