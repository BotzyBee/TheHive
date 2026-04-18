import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import 'dotenv/config';
dotenv.config({ path: '.env' });

const client = new ElevenLabsClient({ apiKey: process.env.EVNLBS_KEY });

export const SpeechService = {
    // ---- STT FOR FRONTEND (STREAMING) ----
    createRealtimeSTT: async (onPartial, onFinal) => {
        return await client.speechToText.realtime.connect({
            modelId: "scribe_v2_realtime",
            onPartialTranscript: (data) => onPartial(data.text),
            onFinalTranscript: (data) => onFinal(data.text),
            onError: (err) => console.error("ElevenLabs WS Error:", err)
        });
    },

    // ---- STT FOR TELEGRAM (BATCH) ----
    transcribeFile: async (audioBuffer) => {
        // Creates a File-like object from the buffer for the SDK
        const blob = new Blob([audioBuffer], { type: 'audio/opus' });
        
        const response = await client.speechToText.convert({
            file: blob,
            model_id: "scribe_v2",
        });
        return response.text;
    },

    // ---- TTS FOR BOTH (GENERATES MP3 BUFFER) ----
    generateSpeech: async (text) => {
        const audioStream = await client.generate({
            voice: "Rachel", // Replace with your Voice ID
            text: text,
            model_id: "eleven_multilingual_v2",
            output_format: "mp3_44100_128"
        });

        // Convert Readable stream to Buffer
        const chunks = [];
        for await (const chunk of audioStream) {
            chunks.push(chunk);
        }
        return Buffer.concat(chunks);
    }
};