import { Controller, Post, UploadedFile, UseInterceptors, Body, BadRequestException } from '@nestjs/common';
import { Get, Param, Res } from '@nestjs/common';
import { ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import { WhisperService } from './whisper.service';
import { Response } from 'express';

@Controller('whisper')
export class WhisperController {
    constructor(private readonly whisperService: WhisperService) {}

    @Post('transcribe')
    @UseInterceptors(FileInterceptor('audio'))
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                audio: { type: 'string', format: 'binary' },
                sessionId: { type: 'string' },
                chunkIndex: { type: 'number' },
                language: { type: 'string', description: "Optional language code (e.g. en, fr, es). If omitted or set to 'auto', Whisper will auto-detect the language and transcribe in the original language (no translation)." }
            }
        }
    })
    async transcribe(@UploadedFile() file: Express.Multer.File, @Body() body: any) {
        if (!file) throw new BadRequestException('audio file required');

        // Accept optional session fields and timestamps from client
        const sessionId = body?.sessionId || `s-${Date.now()}`;
        const chunkIndex = typeof body?.chunkIndex !== 'undefined' ? Number(body.chunkIndex) : 0;
        const language = body?.language;
        const startTime = typeof body?.startTime !== 'undefined' ? Number(body.startTime) : undefined;
        const endTime = typeof body?.endTime !== 'undefined' ? Number(body.endTime) : undefined;

        // Quick hypothesis: use very small model for speed (tiny) - fast but lower quality
        try {
            // Use a slightly larger default quick model for better accuracy (can be overridden with WHISPER_QUICK_MODEL)
            const quickModel = process.env.WHISPER_QUICK_MODEL || 'tiny';
            const quickText = await this.whisperService.transcribeBuffer(file.buffer, file.mimetype, language, quickModel);

            // Store quick result in session with optional timestamps
            try {
                this.whisperService.addSessionChunk(sessionId, chunkIndex, quickText, { startTime, endTime, model: quickModel, quick: true });
            } catch (e) {
                // don't crash if session append fails
                console.warn('Failed to add quick session chunk:', (e as any)?.message ?? e);
            }

            // Respond quickly with the quick hypothesis and assembled session text
            const sessionText = this.whisperService.getSessionText(sessionId);

            // Fire-and-forget: schedule heavier re-processing for higher-quality transcript
            const heavyModel = process.env.WHISPER_MODEL || 'large';
            // Launch background task but do not await
            (async () => {
                try {
                    const refined = await this.whisperService.transcribeBuffer(file.buffer, file.mimetype, language, heavyModel);
                    this.whisperService.addSessionChunk(sessionId, chunkIndex, refined, { startTime, endTime, model: heavyModel, quick: false });
                    // Log when refined chunk is saved to help debugging and client sync
                    console.log(`Refined chunk saved for session ${sessionId} chunk ${chunkIndex} model ${heavyModel}`);
                } catch (bgErr) {
                    console.warn('Background reprocess failed:', (bgErr as any)?.message ?? bgErr);
                }
            })();

            // Return quick hypothesis and mark it as provisional so the client can show a badge
            return { sessionId, chunkIndex, text: quickText, sessionText, queuedBackground: true, provisional: true, quickModel };
        } catch (err: any) {
            // If ffmpeg/unreadable or similar recoverable error, return queued true
            if (err && (err.name === 'UnreadableChunk')) {
                return { sessionId, chunkIndex, text: null, queued: true, reason: err.name };
            }
            return { sessionId, chunkIndex, text: null, queued: false, error: err?.message || 'transcription error' };
        }
    }
    
    @Get('session/:id')
    async getSession(@Param('id') id: string) {
        const text = this.whisperService.getSessionText(id);
        const info = this.whisperService.getSessionInfo(id);
        return { sessionId: id, text, info };
    }

    @Post('session/:id/finalize')
    async finalizeSession(@Param('id') id: string) {
        const text = this.whisperService.finalizeSession(id);
        const info = this.whisperService.getSessionInfo(id);
        return { sessionId: id, text, info };
    }
    
}
