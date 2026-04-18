import 'dotenv/config';
dotenv.config({ path: '.env' });
//import { Telegraf, Input } from 'telegraf';
import { PassThrough } from 'stream';
import { SpeechService } from './elevenLabs.js';
import { normalizeToAudioStream, convertToTelegramVoice } from './processAudio.js';

export async function handleFrontendConnection(ws){
    const inputStream = new PassThrough();
    const normalizedStream = normalizeToAudioStream(inputStream);

    // Initialize ElevenLabs connection
    const scribeConnection = await SpeechService.createRealtimeSTT(
        (text) => ws.send(JSON.stringify({ type: 'partial', text })),
        async (text) => {
            ws.send(JSON.stringify({ type: 'final', text }));
            
            // Botzy Handles the text here (New Botzy Voice Agent?)

            // Generate TTS Response
            const ttsBuffer = await SpeechService.generateSpeech(`I heard you say: ${text}`);
            ws.send(JSON.stringify({ type: 'tts_start' }));
            ws.send(ttsBuffer);
        }
    );

    // Pipe normalized opus audio into ElevenLabs
    normalizedStream.on('data', (chunk) => {
        if (scribeConnection) scribeConnection.sendAudio(chunk);
    });

    // Handle incoming binary messages
    ws.on('message', (message) => {
        inputStream.write(message);
    });

    // Cleanup on disconnect
    ws.on('close', () => {
        inputStream.end();
        console.log('Frontend disconnected');
    });
};

// // ==========================================
// // 2. TELEGRAM: BOT CONTROLLER
// // ==========================================
// const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// bot.on('voice', async (ctx) => {
//     try {
//         // 1. Fetch OGG Voice message from Telegram
//         const fileLink = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
//         const response = await fetch(fileLink.href);
//         const arrayBuffer = await response.arrayBuffer();
//         const incomingBuffer = Buffer.from(arrayBuffer);

//         // 2. Normalize and extract to pure Opus Buffer (optional but safe)
//         // Note: For REST API, ElevenLabs handles OGG well, but keeping with the matrix logic:
//         const transcript = await SpeechService.transcribeFile(incomingBuffer);
        
//         ctx.reply(`Transcription: ${transcript}`);

//         // 3. Generate TTS (MP3 Buffer)
//         const ttsBuffer = await SpeechService.generateSpeech(`You said: ${transcript}`);

//         // 4. Encode to .ogg (Opus) for Telegram Voice Message
//         const telegramOggBuffer = await convertToTelegramVoice(ttsBuffer);

//         // 5. Send native voice message back
//         await ctx.replyWithVoice(Input.fromBuffer(telegramOggBuffer));

//     } catch (error) {
//         console.error("Telegram Processing Error:", error);
//         ctx.reply("Sorry, I had trouble processing that audio.");
//     }
// });

// bot.launch();