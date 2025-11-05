import {
    Injectable,
    Logger,
    HttpException,
    UnauthorizedException,
    BadGatewayException,
    ServiceUnavailableException,
    HttpStatus
} from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class TextGenerationService {
    private readonly logger = new Logger(TextGenerationService.name);

    private readonly client = new OpenAI({
        baseURL: 'https://llm.onerouter.pro/v1',
        apiKey:
            process.env.OPENROUTER_API_KEY ||
            process.env.OPENAI_API_KEY ||
            (() => {
                this.logger.error(
                    'No API key found in environment variables OPENROUTER_API_KEY or OPENAI_API_KEY'
                );
                throw new Error('Missing AI API key configuration');
            })()
    });

    constructor() {
        // Log API key status for debugging (without exposing the actual key)
        const hasOpenrouter = !!process.env.OPENROUTER_API_KEY;
        const hasOpenAI = !!process.env.OPENAI_API_KEY;
        this.logger.debug(
            `API Key Status - OPENROUTER_API_KEY: ${hasOpenrouter}, OPENAI_API_KEY: ${hasOpenAI}`
        );

        if (!hasOpenrouter && !hasOpenAI) {
            this.logger.error('No API keys found in environment variables');
        }
    }

    // Normalize priority values returned by models to one of: 'low' | 'medium' | 'high' | 'urgent'
    private normalizePriority(raw?: string) {
        if (!raw) {
            this.logger.debug(
                'Priority normalization: empty/null input, defaulting to medium'
            );
            return 'medium';
        }

        const original = raw;
        const s = String(raw).toLowerCase().trim();

        if (!s) {
            this.logger.debug(
                'Priority normalization: empty string after trim, defaulting to medium'
            );
            return 'medium';
        }

        // Log the input for debugging
        this.logger.debug(
            `Priority normalization: input="${original}" -> cleaned="${s}"`
        );

        // Priority mappings for 4 levels: low, medium, high, urgent
        if (
            [
                'low',
                'l',
                'faible',
                'basse',
                'bas',
                'minor',
                'optional',
                'sometime',
                'when possible',
                'eventually'
            ].includes(s)
        ) {
            this.logger.debug(`Priority normalization: "${s}" mapped to "low"`);
            return 'low';
        }
        if (
            [
                'medium',
                'med',
                'm',
                'normal',
                'moyen',
                'moyenne',
                'average',
                'standard',
                'regular',
                'default'
            ].includes(s)
        ) {
            this.logger.debug(
                `Priority normalization: "${s}" mapped to "medium"`
            );
            return 'medium';
        }
        if (
            [
                'high',
                'h',
                'haute',
                'élevée',
                'elevee',
                'important',
                'priority',
                'soon',
                'needed'
            ].includes(s)
        ) {
            this.logger.debug(
                `Priority normalization: "${s}" mapped to "high"`
            );
            return 'high';
        }
        if (
            [
                'urgent',
                'u',
                'critical',
                'asap',
                'immediately',
                'crucial',
                'emergency',
                'now',
                'urgent!',
                'critical!'
            ].includes(s)
        ) {
            this.logger.debug(
                `Priority normalization: "${s}" mapped to "urgent"`
            );
            return 'urgent';
        }

        // numeric scale fallback (1-4 scale)
        if (/^[0-9]+$/.test(s)) {
            const n = Number(s);
            if (n <= 1) {
                this.logger.debug(
                    `Priority normalization: numeric "${s}" (${n}) mapped to "low"`
                );
                return 'low';
            }
            if (n === 2) {
                this.logger.debug(
                    `Priority normalization: numeric "${s}" (${n}) mapped to "medium"`
                );
                return 'medium';
            }
            if (n === 3) {
                this.logger.debug(
                    `Priority normalization: numeric "${s}" (${n}) mapped to "high"`
                );
                return 'high';
            }
            if (n >= 4) {
                this.logger.debug(
                    `Priority normalization: numeric "${s}" (${n}) mapped to "urgent"`
                );
                return 'urgent';
            }
        }

        // fallback - log unknown values and default to medium
        this.logger.warn(
            `Priority normalization: unknown value "${original}" (cleaned: "${s}"), defaulting to "medium"`
        );
        return 'medium';
    }

    async generateTask(prompt: string) {
        try {
            this.logger.debug(`Generating task from prompt: "${prompt}"`);

            const response = await this.client.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'user',
                        content: `Analyze this user input: "${prompt}"

Extract a task with appropriate priority. Determine priority based on:

EXPLICIT KEYWORDS:
- URGENT: "emergency", "critical", "ASAP", "immediately", "urgent", "now", "crisis"
- HIGH: "important", "soon", "priority", "needed", "should"  
- MEDIUM: regular tasks, no urgency indicators
- LOW: "when possible", "sometime", "eventually", "optional"

CONTEXT-BASED PRIORITY (when no explicit keywords):
- URGENT: Health emergencies, safety issues, system crashes, deadlines today
- HIGH: Work deadlines (this week), financial matters, important meetings, bills due
- MEDIUM: Regular shopping, routine tasks, general planning, neutral activities
- LOW: Learning/hobbies, maintenance, long-term goals, entertainment

TIME-BASED PRIORITY:
- "today", "now", "this morning" → HIGH/URGENT
- "this week", "by Friday" → HIGH
- "next week", "sometime" → MEDIUM
- "when I can", "eventually" → LOW

TASK TYPE ANALYSIS:
- Medical/Health → URGENT/HIGH
- Work/Business → HIGH/MEDIUM
- Bills/Financial → HIGH
- Shopping/Errands → MEDIUM
- Entertainment/Hobbies → LOW/MEDIUM

Generate exactly this JSON (no extra text):
{
  "title": "<short task title>",
  "description": "<detailed description>", 
  "priority": "<low|medium|high|urgent>"
}

Examples:
- "Buy milk" → MEDIUM (routine shopping)
- "Call doctor about chest pain" → URGENT (health emergency)
- "Submit report by tomorrow" → HIGH (work deadline)
- "Learn guitar when free" → LOW (hobby, no timeline)
- "Fix leaking pipe" → HIGH (home maintenance, could cause damage)

The priority MUST be exactly one of: "low", "medium", "high", "urgent".`
                    }
                ],
                temperature: 0.3
            });

            const content = response.choices[0].message?.content?.trim();
            this.logger.debug(`Raw AI response: "${content}"`);

            if (!content) {
                throw new Error('Empty response from AI');
            }

            // More aggressive cleaning of the response
            let cleanContent = content
                .replace(/```json\s*/gi, '')
                .replace(/```\s*/g, '')
                .replace(/^[^{]*/, '') // Remove any text before the first {
                .replace(/[^}]*$/, '') // Remove any text after the last }
                .trim();

            // Find JSON object in the response
            const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                cleanContent = jsonMatch[0];
            }

            this.logger.debug(`Cleaned content: "${cleanContent}"`);

            if (!cleanContent || !cleanContent.startsWith('{')) {
                throw new Error('No valid JSON found in AI response');
            }

            const parsed = JSON.parse(cleanContent);
            this.logger.debug(`Parsed JSON:`, parsed);

            // Validate required fields
            if (!parsed.title || !parsed.description || !parsed.priority) {
                throw new Error('Missing required fields in AI response');
            }

            // Log original priority before normalization
            this.logger.debug(
                `Original priority from AI: "${parsed.priority}"`
            );
            parsed.priority = this.normalizePriority(parsed.priority);
            this.logger.debug(`Normalized priority: "${parsed.priority}"`);

            return parsed;
        } catch (error: any) {
            this.logger.error('Error in generateTask:', {
                error: error?.message || error,
                response: error?.response?.data,
                prompt: prompt,
                stack: error?.stack
            });

            // Try to extract information manually from the prompt as fallback
            const fallback = this.extractTaskFromPrompt(prompt);
            this.logger.warn('Using fallback extraction:', fallback);
            return fallback;
        }
    }

    // Fallback method to extract basic task info from prompt
    private extractTaskFromPrompt(prompt: string) {
        const lowerPrompt = prompt.toLowerCase();

        // Determine priority from keywords
        let priority = 'medium';
        if (
            lowerPrompt.includes('asap') ||
            lowerPrompt.includes('urgent') ||
            lowerPrompt.includes('immediately') ||
            lowerPrompt.includes('critical')
        ) {
            priority = 'urgent';
        } else if (
            lowerPrompt.includes('important') ||
            lowerPrompt.includes('priority') ||
            lowerPrompt.includes('soon')
        ) {
            priority = 'high';
        } else if (
            lowerPrompt.includes('when possible') ||
            lowerPrompt.includes('sometime') ||
            lowerPrompt.includes('eventually')
        ) {
            priority = 'low';
        }

        // Extract basic title (first few words, cleaned up)
        const title =
            prompt
                .replace(
                    /tomorrow|today|at \d+[ap]m|asap|urgent|immediately/gi,
                    ''
                )
                .trim()
                .split(' ')
                .slice(0, 4)
                .join(' ')
                .replace(/[^\w\s]/g, '')
                .trim() || 'Task';

        return {
            title: title.charAt(0).toUpperCase() + title.slice(1),
            description: `Task: ${prompt}`,
            priority: priority
        };
    }

    async proposeTasksFromUserTasks(
        tasks: any[],
        options?: { maxSuggestions?: number }
    ) {
        const max = options?.maxSuggestions ?? 3;
        try {
            const payloadTasks = JSON.stringify(tasks, null, 2);
            const prompt = `You are a helpful task assistant. Given the following list of user tasks (JSON array):\n\n${payloadTasks}\n\nAnalyze the user's tasks and propose up to ${max} new tasks that would be useful for this user. Consider:\n- recurring routines the user performs frequently,\n- logical follow-ups or dependent tasks that should occur after existing tasks,\n- cleanup/maintenance tasks the user might have missed,\n- sensible priorities and brief reasons why each suggestion is useful.\n\nReturn ONLY a JSON array (no explanation) of objects with these fields: {"title": "<short title>", "description": "<detailed description>", "priority": "<low|medium|high|urgent>", "dependsOn": [<ids or titles of existing tasks, optional>], "reason": "<one-sentence justification>"}.\n\nPriority levels:\n- urgent: critical/emergency tasks\n- high: important tasks with deadlines\n- medium: regular/standard tasks\n- low: optional/when-possible tasks\n\nNow respond.`;

            const response = await this.client.chat.completions.create({
                model: 'gpt-5-chat',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7
            });

            const content = response.choices[0].message?.content?.trim();
            const clean = content?.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(clean || '[]');

            // Normalize priority on each suggested item
            if (Array.isArray(parsed)) {
                return parsed.map((it: any) => ({
                    title: it.title ?? it.titre ?? 'Untitled',
                    description: it.description ?? it.desc ?? '',
                    priority: this.normalizePriority(
                        it.priority ?? it.priorite
                    ),
                    dependsOn: it.dependsOn ?? it.depends ?? [],
                    reason: it.reason ?? '',
                    raw: it
                }));
            }
            return [];
        } catch (error: any) {
            const respData =
                error?.response?.data ||
                error?.response ||
                error?.message ||
                error;
            const status = error?.response?.status;

            // Log full context for debugging (request id sometimes included in provider response)
            this.logger.error(
                'Erreur proposition tâches OpenRouter: status=' +
                    (status || 'unknown') +
                    ' body=' +
                    JSON.stringify(respData)
            );

            // Map provider HTTP status to Nest exceptions so the controller returns an appropriate status code
            if (status === 401) {
                throw new UnauthorizedException(
                    'LLM provider authentication failed'
                );
            }
            if (status === 429) {
                throw new HttpException(
                    'LLM provider rate limit exceeded',
                    HttpStatus.TOO_MANY_REQUESTS
                );
            }
            if (status && status >= 500 && status < 600) {
                throw new BadGatewayException('LLM provider error');
            }

            // Fallback: service unavailable for network/unknown errors
            throw new ServiceUnavailableException('LLM provider unavailable');
        }
    }

    // Test method to debug priority parsing - remove in production
    testPriorityNormalization(testValue: string) {
        this.logger.log(`Testing priority normalization for: "${testValue}"`);
        const result = this.normalizePriority(testValue);
        this.logger.log(`Result: "${testValue}" -> "${result}"`);
        return result;
    }
}
