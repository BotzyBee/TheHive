// elevenLabs.js
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const client = new ElevenLabsClient({ apiKey: process.env.EVNLBS_KEY });

export const SpeechService = {
  // ── STT: batch file upload ────────────────────────────────────────────────
  // Accepts an MP3 buffer and returns the transcript string.
  transcribeFile: async (audioBuffer, mimeType = 'audio/mpeg') => {
    const blob = new Blob([audioBuffer], { type: mimeType });

    const response = await client.speechToText.convert({
      file: blob,
      modelId: 'scribe_v2',
      tagAudioEvents: false,
      languageCode: 'eng',
      diarize: false,
    });

    return response.text;
  },

  // ── TTS: returns an MP3 Buffer ─────────────────────────────────────────────
  generateSpeech: async (text) => {
    const audioStream = await client.textToSpeech.convert(
      'hk6wpUusj7FFV03U5LvR', // "Rachel" voice
      {
        text,
        model_id: 'eleven_multilingual_v2',
        output_format: 'mp3_44100_128',
      }
    );

    const chunks = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  },
};
