import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class OpenrouterService {
  private readonly logger = new Logger(OpenrouterService.name);
  private readonly url = 'https://llm.onerouter.pro/v1/chat/completions';

  private readonly HARDCODED_OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || 'sk-sxg5WwGvgpXsXXMeBB6TbI2k4x4k3Uftd4KeDusj2UcnNvz0'; // ta clé ici

  private getApiKey(): string {
    if (!this.HARDCODED_OPENROUTER_API_KEY) {
      throw new HttpException(
        'OpenRouter API key not set. Set OPENROUTER_API_KEY.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return this.HARDCODED_OPENROUTER_API_KEY;
  }

  private encodeFileToBase64(filePath: string): string {
    const buffer = fs.readFileSync(filePath);
    return buffer.toString('base64');
  }

  async transcribe(audioPath: string, model: string = 'whisper-1') {
    if (!fs.existsSync(audioPath)) {
      throw new HttpException(`Audio file not found: ${audioPath}`, HttpStatus.BAD_REQUEST);
    }

    const ext = path.extname(audioPath).replace('.', '') || 'wav';
    const base64 = this.encodeFileToBase64(audioPath);

    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Please transcribe this audio file.' },
          { type: 'input_audio', input_audio: { data: base64, format: ext } },
        ],
      },
    ];

    const payload = { model, messages };

    try {
      const resp = await axios.post(this.url, payload, {
        headers: {
          Authorization: `Bearer ${this.getApiKey()}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      });

      return resp.data;
    } catch (error: any) {
      const respData = error?.response?.data;
      this.logger.error('OpenRouter request failed', respData || error?.message || error);

      if (error?.response?.status === 401) {
        throw new HttpException('Unauthorized - check your API key', HttpStatus.UNAUTHORIZED);
      }
      throw new HttpException('OpenRouter request failed', HttpStatus.BAD_GATEWAY);
    }
  }
}
