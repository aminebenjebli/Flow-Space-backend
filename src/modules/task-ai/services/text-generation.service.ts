import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class TextGenerationService {
  private readonly logger = new Logger(TextGenerationService.name);

  private readonly client = new OpenAI({
    baseURL: 'https://llm.onerouter.pro/v1',
    apiKey: process.env.ONEROUTER_API_KEY || 'sk-sxg5WwGvgpXsXXMeBB6TbI2k4x4k3Uftd4KeDusj2UcnNvz0',
  });

  async generateTask(prompt: string) {
    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-5-chat',
        messages: [
          {
            role: 'user',
            content: `\nDetect the language of this sentence: "${prompt}".\nThen, write your entire response strictly in that same language.\nDo not translate or switch to another language.\n\nGenerate:\n- a short and natural task title\n- a complete task description\n- a priority level ("low", "normal", or "high")\n\nRespond ONLY in pure JSON, no extra text, no code block.\n\nNow respond for: "${prompt}"\n            `,
          },
        ],
        temperature: 0.7,
      });

      const content = response.choices[0].message?.content?.trim();
      const cleanContent = content?.replace(/```json|```/g, '').trim();

      return JSON.parse(cleanContent);
    } catch (error: any) {
      this.logger.error('Erreur génération modèle OpenRouter:', error?.response?.data || error?.message || error);
      return {
        title: 'Titre générique',
        description: 'Description générique',
        priority: 'normal',
      };
    }
  }
}
