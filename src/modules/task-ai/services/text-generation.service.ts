import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class TextGenerationService {
  private readonly logger = new Logger(TextGenerationService.name);

  private readonly client = new OpenAI({
    baseURL: 'https://llm.onerouter.pro/v1',
    apiKey: process.env.ONEROUTER_API_KEY || '',
  });

  // Normalize priority values returned by models to one of: 'low' | 'normal' | 'high'
  private normalizePriority(raw?: string) {
    if (!raw) return 'normal';
    const s = String(raw).toLowerCase().trim();
    if (!s) return 'normal';
    // common mappings
    if (['low', 'l', 'faible', 'basse'].includes(s)) return 'low';
    if (['high', 'h', 'haute', 'élevée', 'elevee', 'urgent'].includes(s)) return 'high';
    if (['normal', 'medium', 'moyen', 'moyenne', 'average'].includes(s)) return 'normal';
    // numeric scale fallback
    if (/^[0-9]+$/.test(s)) {
      const n = Number(s);
      if (n <= 2) return 'low';
      if (n >= 4) return 'high';
      return 'normal';
    }
    // fallback
    return 'normal';
  }

  async generateTask(prompt: string) {
    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-5-chat',
        messages: [
          {
            role: 'user',
            content: `\nDetect the language of this sentence: "${prompt}".\nThen, write your entire response strictly in that same language.\nDo not translate or switch to another language.\n\nGenerate exactly the following JSON object (no extra text, no code fences):\n{\n  "title": "<a short natural title>",\n  "description": "<a complete task description>",\n  "priority": "<one of: low, normal, high>"\n}\n\nImportant: the value of \"priority\" MUST be exactly one of the strings: \"low\", \"normal\", or \"high\" (do not output \"medium\" or other synonyms).\n\nNow respond for: "${prompt}"\n            `,
          },
        ],
        temperature: 0.7,
      });

      const content = response.choices[0].message?.content?.trim();
      const cleanContent = content?.replace(/```json|```/g, '').trim();

      const parsed = JSON.parse(cleanContent);
      // ensure priority normalized
      if (parsed && typeof parsed === 'object') {
        parsed.priority = this.normalizePriority(parsed.priority);
      }
      return parsed;
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
