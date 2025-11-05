import { Injectable, Logger, HttpException, UnauthorizedException, BadGatewayException, ServiceUnavailableException, HttpStatus } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class TextGenerationService {
  private readonly logger = new Logger(TextGenerationService.name);

  private readonly client = new OpenAI({
    baseURL: 'https://llm.onerouter.pro/v1',
    apiKey: process.env.ONEROUTER_API_KEY || 'sk-VUw8FKc1rBuVAuzl7g5oXT7Fo2hpL6WpdW38MgD5pSkQRVoc',
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

 
  async proposeTasksFromUserTasks(tasks: any[], options?: { maxSuggestions?: number }) {
    const max = options?.maxSuggestions ?? 3;
    try {
      const payloadTasks = JSON.stringify(tasks, null, 2);
      const prompt = `You are a helpful task assistant. Given the following list of user tasks (JSON array):\n\n${payloadTasks}\n\nAnalyze the user's tasks and propose up to ${max} new tasks that would be useful for this user. Consider:\n- recurring routines the user performs frequently,\n- logical follow-ups or dependent tasks that should occur after existing tasks,\n- cleanup/maintenance tasks the user might have missed,\n- sensible priorities and brief reasons why each suggestion is useful.\n\nReturn ONLY a JSON array (no explanation) of objects with these fields: {"title": "<short title>", "description": "<detailed description>", "priority": "<low|normal|high>", "dependsOn": [<ids or titles of existing tasks, optional>], "reason": "<one-sentence justification>"}.\n\nNow respond.`;

      const response = await this.client.chat.completions.create({
        model: 'gpt-5-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });

      const content = response.choices[0].message?.content?.trim();
      const clean = content?.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean || '[]');

      // Normalize priority on each suggested item
      if (Array.isArray(parsed)) {
        return parsed.map((it: any) => ({
          title: it.title ?? it.titre ?? 'Untitled',
          description: it.description ?? it.desc ?? '',
          priority: this.normalizePriority(it.priority ?? it.priorite),
          dependsOn: it.dependsOn ?? it.depends ?? [],
          reason: it.reason ?? '',
          raw: it,
        }));
      }
      return [];
    } catch (error: any) {
      const respData = error?.response?.data || error?.response || error?.message || error;
      const status = error?.response?.status;

      // Log full context for debugging (request id sometimes included in provider response)
      this.logger.error('Erreur proposition tâches OpenRouter: status=' + (status || 'unknown') + ' body=' + JSON.stringify(respData));

      // Map provider HTTP status to Nest exceptions so the controller returns an appropriate status code
      if (status === 401) {
        throw new UnauthorizedException('LLM provider authentication failed');
      }
      if (status === 429) {
        throw new HttpException('LLM provider rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
      }
      if (status && status >= 500 && status < 600) {
        throw new BadGatewayException('LLM provider error');
      }

      // Fallback: service unavailable for network/unknown errors
      throw new ServiceUnavailableException('LLM provider unavailable');
    }
  }

  
}
