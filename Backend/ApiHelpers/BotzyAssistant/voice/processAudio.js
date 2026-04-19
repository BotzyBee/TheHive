// processAudio.js
import ffmpeg from 'fluent-ffmpeg';
import { PassThrough, Readable } from 'stream';

/**
 * Convert a raw audio Buffer (WebM, Ogg, MP4, etc.) to an MP3 Buffer.
 * Used before handing audio off to the ElevenLabs batch STT endpoint.
 *
 * @param {Buffer} inputBuffer   - Raw audio bytes from the browser
 * @param {string} inputFormat   - FFmpeg input format hint ('webm', 'ogg', 'mp4', …)
 * @returns {Promise<Buffer>}    - MP3-encoded audio
 */
export const convertToMp3Buffer = (inputBuffer, inputFormat = 'webm') => {
    return new Promise((resolve, reject) => {
        // Wrap the buffer in a readable stream so fluent-ffmpeg can consume it
        const inputStream  = Readable.from(inputBuffer);
        const outputStream = new PassThrough();

        const chunks = [];
        outputStream.on('data',  (chunk) => chunks.push(chunk));
        outputStream.on('end',   ()      => resolve(Buffer.concat(chunks)));
        outputStream.on('error', reject);

        ffmpeg(inputStream)
            .inputFormat(inputFormat)
            .audioCodec('libmp3lame')
            .audioBitrate('128k')
            .audioChannels(1)
            .audioFrequency(16000)
            .format('mp3')
            .on('error', (err) => {
                console.error('[FFmpeg] Conversion error:', err.message);
                reject(err);
            })
            .pipe(outputStream);
    });
};


/**
 * SOURCE: Frontend WebSockets (WebM) — kept for reference / future use
 * PROCESS: Strip container / Extract & encode to raw PCM 16kHz
 * DESTINATION: Streaming STT (not currently used)
 */
export const normalizeToPCMStream = (inputStream, inputFormat = 'webm') => {
    const outputStream = new PassThrough();

    ffmpeg(inputStream)
        .inputFormat(inputFormat)
        .audioCodec('pcm_s16le')
        .format('s16le')
        .audioChannels(1)
        .audioFrequency(16000)
        .on('error', (err) => {
            console.error('[FFmpeg] PCM stream error:', err.message);
            outputStream.end();
        })
        .pipe(outputStream);

    return outputStream;
};