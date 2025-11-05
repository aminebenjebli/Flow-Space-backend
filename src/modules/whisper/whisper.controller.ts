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

        // sessionId and chunkIndex optional
        const sessionId = body?.sessionId || `s-${Date.now()}`;
        const chunkIndex = body?.chunkIndex ? Number(body.chunkIndex) : 0;

    // No persistent save of audio chunks (we only use in-memory buffer)

        // Try immediate transcription of this chunk
        try {
            const text = await this.whisperService.transcribeBuffer(file.buffer, file.mimetype, body?.language);
            // If a sessionId was provided, append this chunk's text into the session store
            if (sessionId) {
                try {
                    const sessionText = this.whisperService.addSessionChunk(sessionId, chunkIndex, text);
                    return { sessionId, chunkIndex, text, sessionText, queued: false };
                } catch (e) {
                    // still return chunk-level text if session append failed
                    return { sessionId, chunkIndex, text, queued: false };
                }
            }
            return { sessionId, chunkIndex, text, queued: false };
        } catch (err: any) {
            // If it's a quota error, enqueue chunk for later processing
            // If quota or unreadable, return queued=true so client can re-upload later
            if (err && (err.name === 'QuotaExceeded' || err.name === 'UnreadableChunk')) {
                return { sessionId, chunkIndex, text: null, queued: true, reason: err.name };
            }

            // other errors: return error message
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
