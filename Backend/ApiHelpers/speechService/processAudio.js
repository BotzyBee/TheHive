// audio.js
import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';

/**
 * SOURCE: Frontend (WebM) & Telegram (OGG)
 * PROCESS: Strip container / Extract & Normalize Opus
 * DESTINATION: ElevenLabs STT
 */
export const normalizeToAudioStream = (inputStream) => {
    const outputStream = new PassThrough();
    
    ffmpeg(inputStream)
        // Normalize everything to a clean Opus stream. 
        // Note: If ElevenLabs rejects raw 'opus', change format to 's16le' (PCM 16-bit)
        .audioCodec('libopus')
        .format('opus') 
        .on('error', (err) => console.error('FFmpeg Normalization Error:', err.message))
        .pipe(outputStream);
        
    return outputStream;
};

/**
 * SOURCE: ElevenLabs TTS (MP3 / Raw Buffer)
 * PROCESS: Encode to .ogg (Opus)
 * DESTINATION: Telegram sendVoice
 */
export const convertToTelegramVoice = async (audioBuffer) => {
    return new Promise((resolve, reject) => {
        const inputStream = new PassThrough();
        inputStream.end(audioBuffer);
        
        const chunks = [];
        const outputStream = new PassThrough();
        
        outputStream.on('data', chunk => chunks.push(chunk));
        outputStream.on('end', () => resolve(Buffer.concat(chunks)));
        outputStream.on('error', reject);

        ffmpeg(inputStream)
            .inputFormat('mp3') // Assumes ElevenLabs output is MP3
            .audioCodec('libopus')
            .audioFrequency(48000)
            .format('ogg')
            .on('error', reject)
            .pipe(outputStream);
    });
};