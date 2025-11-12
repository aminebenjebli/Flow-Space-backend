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
                // English
                'low', 'l', 'minor', 'optional', 'sometime', 'when possible', 'eventually',
                // French
                'faible', 'basse', 'bas',
                // Spanish
                'bajo', 'baja', 'baja prioridad',
                // Portuguese
                'baixo',
                // German
                'niedrig'
            ].includes(s)
        ) {
            this.logger.debug(`Priority normalization: "${s}" mapped to "low"`);
            return 'low';
        }
        if (
            [
                // English
                'medium', 'med', 'm', 'average', 'standard', 'regular', 'default',
                // French
                'normal', 'moyen', 'moyenne',
                // Spanish
                'medio', 'media',
                // Portuguese
                'médio', 'medio',
                // German
                'mittel'
            ].includes(s)
        ) {
            this.logger.debug(
                `Priority normalization: "${s}" mapped to "medium"`
            );
            return 'medium';
        }
        if (
            [
                // English
                'high', 'h', 'important', 'priority', 'soon', 'needed',
                // French
                'haute', 'élevée', 'elevee',
                // Spanish
                'alto', 'alta', 'importante', 'urgente',
                // Portuguese
                'alto', 'importante',
                // German
                'hoch'
            ].includes(s)
        ) {
            this.logger.debug(
                `Priority normalization: "${s}" mapped to "high"`
            );
            return 'high';
        }
        if (
            [
                // English
                'urgent', 'u', 'critical', 'asap', 'immediately', 'crucial', 'emergency', 'now',
                // French
                'urgent', 'urgence', 'immédiat', 'immédiatement', 'critique',
                // Spanish
                'urgente', 'ahora', 'inmediato',
                // Portuguese
                'urgente', 'agora',
                // German
                'dringend', 'sofort'
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

            // detect language of the prompt so the model responds in same language
            const lang = this.detectLanguage(prompt);
            const langNames: { [k: string]: string } = {
                fr: 'French',
                es: 'Spanish',
                pt: 'Portuguese',
                de: 'German',
                en: 'English'
            };
            const langName = langNames[lang] || 'English';

            const response = await this.client.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'user',


                        content: `Analyze this user input: "${prompt}"

Respond in ${langName} (the same language as the input). IMPORTANT:

- Title requirements: produce a CLEAR, NON-CONJUGATED title. Use the infinitive form in French (e.g. "Finaliser le rapport") or the base verb / noun phrase in English (e.g. "Fix production outage"). Do NOT return a conjugated verb or a first-person sentence as the title (avoid "Je finalise..." or "I am finishing..."). Title must be 2-9 words, succinct and actionable. IMPORTANT: the title MUST NOT contain any verbatim phrase of 3 or more consecutive words taken exactly from the user's input. It should be a newly generated short summary, not a copy.

- Description requirements: produce a DETAILED description (2-3 short sentences) that reads as if the user wrote it (use first-person when appropriate). Do NOT start with "The user" or mention "the user". Preserve entities (dates, names) and give a brief next-step or context if available.

Extract a task with appropriate priority AND a task status. Determine priority based on the rules below and determine status among exactly these four values: "To Do", "In Progress", "Done", "Cancelled".

In addition to the fields below, also return these two fields to help server-side decision logic:
- "priorityConfidence": a float between 0.0 and 1.0 indicating how confident you are about the priority choice (e.g. 0.85)
- "priorityReason": a one-sentence justification explaining why you chose that priority

EXPLICIT KEYWORDS FOR PRIORITY:
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

STATUS RULES:
- "Done"/"finished"/"completed" → "Done"
- "in progress"/"doing"/"working on" → "In Progress"
- "cancel"/"canceled"/"abandon"/"abandoned" → "Cancelled"
- otherwise default to "To Do"

Generate exactly this JSON (no extra text):
{
    "title": "<short task title>",
    "description": "<detailed description>", 
    "priority": "<low|medium|high|urgent>",
    "priorityConfidence": <0.0-1.0 float>,
    "priorityReason": "<one-sentence justification>",
    "status": "<To Do|In Progress|Done|Cancelled>"
}

Examples:
- "Buy milk" → MEDIUM, status: "To Do"
- "Call doctor about chest pain" → URGENT, status: "To Do" (unless user says they already called / completed)
- "Submit report by tomorrow" → HIGH, status: "To Do"
- "I've paid the bill" → MEDIUM/HIGH, status: "Done"
- "Working on the report" → HIGH, status: "In Progress"

The priority MUST be exactly one of: "low", "medium", "high", "urgent".
The status MUST be exactly one of: "To Do", "In Progress", "Done", "Cancelled".`
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

            // Validate required fields (allow missing confidence/reason but ensure core fields present)
            if (!parsed.title || !parsed.description || !parsed.priority || !parsed.status) {
                throw new Error('Missing required fields in AI response');
            }

            // Ensure optional priority metadata are numeric / strings
            try {
                parsed.priorityConfidence = parsed.priorityConfidence !== undefined ? Number(parsed.priorityConfidence) : null;
            } catch (e) {
                parsed.priorityConfidence = null;
            }
            parsed.priorityReason = parsed.priorityReason ? String(parsed.priorityReason) : '';

            // Log original priority before normalization
            this.logger.debug(`Original priority from AI: "${parsed.priority}"`);
            parsed.priority = this.normalizePriority(parsed.priority);
            this.logger.debug(`Normalized priority: "${parsed.priority}"`);

            // Normalize status to one of the allowed labels
            this.logger.debug(`Original status from AI: "${parsed.status}"`);
            parsed.status = this.normalizeStatus(parsed.status);
            this.logger.debug(`Normalized status: "${parsed.status}"`);

            // attach detected language and localized status label for UI display
            parsed.language = lang;
            parsed.statusLabel = this.localizeStatus(parsed.status, lang);

            // Return also priority metadata when available
            // parsed.priority already normalized below
            parsed.priorityConfidence = parsed.priorityConfidence ?? null;
            parsed.priorityReason = parsed.priorityReason ?? '';

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

        // Determine priority from multilingual keywords (use word boundaries)
        let priority = 'medium';
        try {
            const p = prompt.toLowerCase();
            const urgentKeywords = [
                'asap', 'urgent', 'immediately', 'critical', 'emergency', 'now', // en
                'urgence', 'immédiat', 'immédiatement', 'critique', // fr
                'urgente', 'ahora', 'inmediato', 'urgencia', // es
                'urgente', 'agora', // pt
                'dringend', 'sofort' // de
            ];
            const highKeywords = [
                'important', 'priority', 'soon', 'needed', // en
                'important', 'moyen', // fr (some overlap)
                'importante', 'pronto', // es
                'importante', // pt
                'wichtig' // de
            ];
            const lowKeywords = [
                'when possible', 'sometime', 'eventually', 'optional', // en
                'quand possible', 'eventuellement', 'optionnel', // fr
                'cuando pueda', 'alguna vez', 'opcional', // es
                'quando puder', 'opcional', // pt
                'wenn möglich' // de
            ];

            const esc = (arr: string[]) => arr.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

            if (new RegExp(`\\b(${esc(urgentKeywords)})\\b`, 'i').test(p)) priority = 'urgent';
            else if (new RegExp(`\\b(${esc(highKeywords)})\\b`, 'i').test(p)) priority = 'high';
            else if (new RegExp(`\\b(${esc(lowKeywords)})\\b`, 'i').test(p)) priority = 'low';
        } catch (e) {
            this.logger.warn('Priority heuristic failed, defaulting to medium', e?.message || e);
            priority = 'medium';
        }

    // Detect language early (model-level detection)
    const lang = this.detectLanguage(prompt);

    // Determine output language by simple token-count heuristic to avoid mixing languages
    // (prefer dominant tokens in the prompt). This helps ensure title/description are
    // produced in a single consistent language even when the input is mixed.
    const lowerForLang = prompt.toLowerCase();
    const frenchHints = [' je ', " j'", ' le ', ' la ', 'merci', 'facture', 'service', 'corriger', 'préparer', 'en train', 'aujourd'];
    const englishHints = [" i ", " i'm ", " i'", ' need ', ' please ', ' thank', 'invoice', 'service', 'fix', 'finalize', 'working on'];
    let frCount = 0;
    let enCount = 0;
    for (const h of frenchHints) if (lowerForLang.includes(h)) frCount++;
    for (const h of englishHints) if (lowerForLang.includes(h)) enCount++;
    let outputLang = lang;
    if (frCount > enCount && frCount > 0) outputLang = 'fr';
    else if (enCount > frCount && enCount > 0) outputLang = 'en';

        // --- generate a synthetic title (avoid verbatim copy, ensure non-conjugated) ---
        // remove leading modal/first-person patterns to avoid conjugated forms in title
        let titleSource = prompt.trim();
        titleSource = titleSource.replace(/^(I need to|I have to|I'm going to|I'm|I've|I will|I want to)\s+/i, '');
        titleSource = titleSource.replace(/^(Je dois|J'|Je vais|Je veux|J'ai|Je suis|Je)\s+/i, '');
        titleSource = titleSource.replace(/^(please|pls|could you|por favor|s'il vous plaît)\s*/i, '');

    const stopwordsEn = new Set(['the','a','an','to','for','on','in','at','of','and','or','please','pls','could','you','i','we']);
    const stopwordsFr = new Set(['le','la','les','un','une','des','de','du','pour','sur','dans','et','ou','je','nous','s\'il','svp']);
    const stopwordsEs = new Set(['el','la','los','las','un','una','unos','unas','de','del','para','por','en','y','o','por favor','porfa','que']);
    const stopwordsPt = new Set(['o','a','os','as','um','uma','de','do','da','para','por','em','e','ou','por favor']);
    const stopwordsDe = new Set(['der','die','das','ein','eine','den','dem','von','zu','für','und','oder','bitte']);
        const words = titleSource
            .replace(/[^\p{L}\p{N}'\s-]+/gu, ' ')
            .split(/\s+/)
            .filter(w => w.length > 0);

    // Use the chosen output language (outputLang) to pick stopwords so generated
    // title/description follow a consistent language.
    let stopwords = stopwordsEn;
    if (outputLang === 'fr') stopwords = stopwordsFr;
    else if (outputLang === 'es') stopwords = stopwordsEs;
    else if (outputLang === 'pt') stopwords = stopwordsPt;
    else if (outputLang === 'de') stopwords = stopwordsDe;
        const nonStop = words.filter(w => !stopwords.has(w.toLowerCase()));

        // mapping of common keywords to an action verb (base form) to synthesize a short title
        const verbMapEn: { [k: string]: string } = {
            report: 'Finalize', invoice: 'Pay', bill: 'Pay', doctor: 'Call', call: 'Call', fix: 'Fix', outage: 'Fix', buy: 'Buy', purchase: 'Buy', schedule: 'Schedule', meeting: 'Schedule', email: 'Send', submit: 'Submit', review: 'Review', test: 'Test'
        };
        const verbMapFr: { [k: string]: string } = {
            rapport: 'Finaliser', facture: 'Payer', appel: 'Appeler', reparer: 'Réparer', réparer: 'Réparer', panne: 'Réparer', acheter: 'Acheter', programmer: 'Planifier', réunion: 'Planifier', envoyer: 'Envoyer', soumettre: 'Soumettre', relire: 'Relire', tester: 'Tester'
        };
        const verbMapEs: { [k: string]: string } = {
            reporte: 'Finalizar', informe: 'Finalizar', factura: 'Pagar', llamada: 'Llamar', reparar: 'Reparar', comprar: 'Comprar', programar: 'Programar', reunion: 'Programar', enviar: 'Enviar', revisar: 'Revisar', probar: 'Probar'
        };
        const verbMapPt: { [k: string]: string } = {
            relatorio: 'Finalizar', fatura: 'Pagar', chamada: 'Ligar', reparar: 'Reparar', comprar: 'Comprar', agendar: 'Agendar', reuniao: 'Agendar', enviar: 'Enviar', revisar: 'Revisar', testar: 'Testar'
        };
        const verbMapDe: { [k: string]: string } = {
            bericht: 'Fertigstellen', rechnung: 'Bezahlen', anruf: 'Anrufen', reparieren: 'Reparieren', kaufen: 'Kaufen', planen: 'Planen', treffen: 'Planen', senden: 'Senden', pruefen: 'Pruefen', testen: 'Testen'
        };

        // find keyword in prompt to choose verb and object
    const lowerWords = words.map(w => w.toLowerCase());
    // Choose verb base form according to the output language
    let chosenVerb = 'Finalize';
    if (outputLang === 'fr') chosenVerb = 'Finaliser';
    else if (outputLang === 'es') chosenVerb = 'Finalizar';
    else if (outputLang === 'pt') chosenVerb = 'Finalizar';
    else if (outputLang === 'de') chosenVerb = 'Fertigstellen';
        let objectWords = nonStop.slice(0, 3).map(w => w.replace(/[^\p{L}\p{N}'-]+/gu, '')).join(' ');

    // Use searchMap corresponding to the output language to favour verbs in that language
    let searchMap: { [k: string]: string } = verbMapEn;
    if (outputLang === 'fr') searchMap = verbMapFr;
    else if (outputLang === 'es') searchMap = verbMapEs;
    else if (outputLang === 'pt') searchMap = verbMapPt;
    else if (outputLang === 'de') searchMap = verbMapDe;
        let foundKey: string | undefined;
        for (const k of Object.keys(searchMap)) {
            if (lowerPrompt.includes(k)) {
                foundKey = k;
                chosenVerb = searchMap[k];
                break;
            }
        }

        if (foundKey) {
            // try to build object from the keyword position
            const idx = lowerWords.findIndex(w => w.includes(foundKey));
            if (idx !== -1) {
                objectWords = words.slice(idx, idx + 3).map(w => w.replace(/[^\p{L}\p{N}'-]+/gu, '')).join(' ');
            } else {
                objectWords = foundKey;
            }
        }

        // ensure object is not empty
        if (!objectWords) {
            objectWords = nonStop.slice(0, 2).join(' ');
        }

        let title = `${chosenVerb} ${objectWords}`.trim();

        // Avoid verbatim copying: if the generated title appears verbatim in the prompt and is 3+ words, shorten or rephrase
        const lowerTitle = title.toLowerCase();
        if (lowerTitle.split(/\s+/).length >= 3 && lowerPrompt.includes(lowerTitle)) {
            // shorten to verb + first noun word
            const firstObj = objectWords.split(/\s+/)[0] || objectWords;
            title = `${chosenVerb} ${firstObj}`;
        }

        // Remove trailing connector/preposition words that may have been included
        // e.g. 'Finaliser rapport trimestriel pour' -> 'Finaliser rapport trimestriel'
        const connectors = new Set([
            // English / French / Spanish / Portuguese / German common connectors
            'for', 'pour', 'to', 'because', 'afin', 'so', 'que', 'de', 'du', 'des', 'pourquoi', 'before', 'after',
            'para', 'por', 'porque', 'antes', 'después', 'despues', 'antes', 'após', 'nach', 'für', 'um', 'weil'
        ]);
        let parts = title.split(/\s+/).filter(p => p.length > 0);
        // strip trailing connectors
        while (parts.length > 1) {
            const last = parts[parts.length - 1].toLowerCase().replace(/[^\p{L}\p{N}-]+/gu, '');
            if (connectors.has(last)) {
                parts.pop();
            } else {
                break;
            }
        }

        // ensure title length between 2 and 6 words: if too long, keep first 5 words; if too short and we can append a non-stopword, do it
        if (parts.length > 6) parts = parts.slice(0, 5);
        if (parts.length < 2 && nonStop.length > 0) {
            // try to append one more meaningful word
            const extra = nonStop.find(w => !connectors.has(w.toLowerCase())) ?? nonStop[0];
            if (extra) parts.push(extra.replace(/[^\p{L}\p{N}-]+/gu, ''));
        }

        title = parts.join(' ').trim();

        // final cleanup and capitalization
        title = title.replace(/\s+/g, ' ').trim();
        title = title.replace(/^(je |j'|i |i'm |i've )/i, '').trim();
    if (!title) title = outputLang === 'fr' ? 'Tâche' : 'Task';
        title = title.charAt(0).toUpperCase() + title.slice(1);

        // --- determine status heuristically (multilingual word-boundary regex) ---
        let status = 'To Do';
        try {
            const p = prompt.toLowerCase();
            // Done indicators (EN/FR/ES/PT/DE)
            if (/\b(done|finished|completed|fini|fait|hecho|terminado|feito|completado|erledigt)\b/i.test(p) || /\bj'?ai fait\b/i.test(p)) {
                status = 'Done';
            }
            // In Progress indicators (expanded to include progressive forms and verb stems)
            else if (/\b(in progress|working on|doing|progress|en cours|en train(?: de)?|je suis en train(?: de)?|suis en train(?: de)?|en progreso|trabajando|haciendo|em andamento|estou trabalhando|estoy trabajando|ich arbeite|arbeite)\b/i.test(p)
                || /\bpr[eé]par(?:e|er|ant|é|ation)?\b/i.test(p)
            ) {
                status = 'In Progress';
            }
            // Cancelled indicators
            else if (/\b(cancel|cancelled|canceled|abandon|abandoned|annulé|anulado|cancelado|abbrechen|abgesagt)\b/i.test(p) || /\bannul(e|é)\b/i.test(p)) {
                status = 'Cancelled';
            }
        } catch (e) {
            this.logger.warn('Status heuristic failed, defaulting to To Do', e?.message || e);
            status = 'To Do';
        }

        // --- generate a detailed paraphrased description in user's voice (not verbatim) ---
        const descMax = 500; // allow a longer, more detailed description
        let description = '';

    // Detect if input already in first-person (multilingual)
    const firstPersonEn = /\bI\b|\bI'm\b|\bI have\b|\bI've\b/i.test(prompt);
    const firstPersonFr = /\bje\b|\bj'\b|\bJ'|\bJe\b/i.test(prompt);
    const firstPersonEs = /\byo\b|\bestoy\b|\btengo\b|\bnecesito\b|\bhe\b/i.test(prompt);
    const firstPersonPt = /\beu\b|\bestou\b|\btenho\b|\bpreciso\b|\bj(a|á)\b/i.test(prompt);
    const firstPersonDe = /\bich\b|\bbin\b|\bhabe\b|\bwerde\b/i.test(prompt);
    let isFirstPerson = false;
    if (lang === 'fr') isFirstPerson = firstPersonFr;
    else if (lang === 'es') isFirstPerson = firstPersonEs;
    else if (lang === 'pt') isFirstPerson = firstPersonPt;
    else if (lang === 'de') isFirstPerson = firstPersonDe;
    else isFirstPerson = firstPersonEn;

        if (isFirstPerson) {
            // paraphrase into 2-3 short sentences, keep user's voice
            let p = prompt.trim().replace(/\s+/g, ' ');
            p = p.replace(/\bI've\b/g, 'I have').replace(/\bI'm\b/g, 'I am');
            if (!/[.!?]$/.test(p)) p = p + '.';
            // add a small contextual follow-up sentence when possible
            let followUp = '';
            if (/report|rapport/i.test(p)) {
                followUp = outputLang === 'fr' ? 'Je prévois de finaliser les sections principales et de relire avant envoi.' : 'I plan to finish the main sections and review before submission.';
            } else if (/invoice|bill|facture/i.test(p)) {
                followUp = outputLang === 'fr' ? "Je vérifierai le reçu et mettrai à jour l'état." : 'I will verify the receipt and update the status.';
            } else if (/fix|fixing|fixe|réparer|fixer|outage|panne/i.test(p)) {
                followUp = outputLang === 'fr' ? "Je vais diagnostiquer le problème et appliquer la correction." : 'I will diagnose the issue and apply a fix.';
            }
            description = (p + (followUp ? ' ' + followUp : '')).trim();
            if (description.length > descMax) description = description.slice(0, descMax).trim() + '...';
            if (outputLang === 'fr') description = description.charAt(0).toUpperCase() + description.slice(1);
        } else {
            // not first-person: create a 2-sentence first-person paraphrase to provide detail
            let cleaned = prompt.trim().replace(/\s+/g, ' ');
            cleaned = cleaned.replace(/^(please|pls|could you|por favor|s'il vous plaît)\s*/i, '');
            if (outputLang === 'fr') {
                // prefer 'Je dois ...' + a short next-step sentence
                let s1 = `Je dois ${cleaned}`.trim();
                if (!/[.!?]$/.test(s1)) s1 += '.';
                let s2 = 'Je vais m’en occuper et je ferai un point après.';
                description = `${s1} ${s2}`;
            } else {
                let s1 = `I need to ${cleaned}`.trim();
                if (!/[.!?]$/.test(s1)) s1 += '.';
                let s2 = 'I will take care of this and follow up afterwards.';
                description = `${s1} ${s2}`;
            }
            if (description.length > descMax) description = description.slice(0, descMax).trim() + '...';
        }

        // --- Ensure coherence between title and description ---
        try {
            const titleParts = title.split(/\s+/).filter(Boolean);
            const verb = titleParts[0] || '';
            const obj = titleParts.slice(1).join(' ');
            const descLower = (description || '').toLowerCase();

            // choose a meaningful token from object to check presence in description
            let objKey = '';
            if (obj) {
                const objTokens = obj.split(/\s+/).filter(w => w.length > 2);
                objKey = (objTokens[0] || obj.split(/\s+/)[0] || '').toLowerCase();
            }

            if (objKey && !descLower.includes(objKey)) {
                // build a small, first-person follow-up sentence that references the title object
                let followUp = '';
                if (outputLang === 'fr') {
                    const verbLower = verb ? verb.toLowerCase() : 'm\'occuper';
                    followUp = `Je vais ${verbLower} ${obj}.`;
                } else {
                    const verbLower = verb ? verb.toLowerCase() : 'take care of';
                    // ensure verbLower is readable in english (small heuristic)
                    followUp = `I will ${verbLower} ${obj}.`;
                }

                // Append followUp if it adds clarity and doesn't already exist
                if (!descLower.includes(followUp.toLowerCase())) {
                    // ensure description has 1-2 sentences before adding to make total 2-3 sentences
                    const sentences = (description.match(/[^.!?]+[.!?]?/g) || []).map(s => s.trim()).filter(Boolean);
                    if (sentences.length < 2) {
                        // add followUp to reach at least 2 sentences
                        description = (description.trim() + (/[.!?]$/.test(description.trim()) ? ' ' : '. ') + followUp).trim();
                    } else {
                        // append followUp but avoid exceeding 3 sentences
                        if (sentences.length < 3) {
                            description = description.trim();
                            if (!/[.!?]$/.test(description)) description += '.';
                            description = `${description} ${followUp}`;
                        }
                    }
                }
            }

            // Final safety: limit description to at most 3 sentences
            const finalSentences = (description.match(/[^.!?]+[.!?]?/g) || []).map(s => s.trim()).filter(Boolean);
            if (finalSentences.length > 3) {
                description = finalSentences.slice(0, 3).join(' ');
            }
        } catch (e) {
            // if coherence adjustment fails for any reason, keep original description
            this.logger.warn('Coherence adjustment failed:', e?.message || e);
        }

        return {
            title,
            description,
            priority: priority,
            status: status,
            // reflect the chosen output language (may differ from initial detection)
            language: outputLang,
            statusLabel: this.localizeStatus(status, outputLang)
        };
    }

    // Normalize various status strings to one of the canonical labels
    private normalizeStatus(raw?: string) {
        if (!raw) return 'To Do';
        const s = String(raw).toLowerCase().trim();
        if (!s) return 'To Do';

        try {
            // Match whole words to avoid substring collisions (multilingual)
            if (/\b(done|finished|completed|fini|fait|hecho|terminado|feito|completado|erledigt)\b/.test(s)) return 'Done';
                if (/\b(in progress|in_progress|doing|working on|en cours|en train(?: de)?|je suis en train(?: de)?|suis en train(?: de)?|en progreso|trabajando|haciendo|em andamento|estou trabalhando|estoy trabajando|in bearbeitung)\b/.test(s)) return 'In Progress';
            if (/\b(cancel|cancelled|canceled|abandon|abandoned|annulé|anulado|cancelado|abbrechen|abgesagt)\b/.test(s)) return 'Cancelled';

            // Try to map common single-word tokens exactly
            if (s === 'todo' || s === 'to do' || s === 'todolist') return 'To Do';
        } catch (e) {
            this.logger.warn('normalizeStatus regex matching failed', e?.message || e);
        }

        // Fallback
        this.logger.warn(`Unknown status value from AI: "${raw}", defaulting to 'To Do'`);
        return 'To Do';
    }

    // Detect language from text using simple keyword heuristics
    private detectLanguage(text?: string) {
        const t = (text || '').toLowerCase();
        if (!t) return 'en';

        const checks: { [k: string]: string[] } = {
            fr: ['aujourd', 'demain', 'prochain', 'prochaine', "j'", 'je ', 'annulé', 'facture', 'appel', 'bonjour', 'merci'],
            es: ['mañana', 'próxima', 'enero', 'febrero', 'hola', 'gracias', 'llamar'],
            pt: ['amanhã', 'janeiro', 'obrigado', 'por favor'],
            de: ['morgen', 'januar', 'hallo', 'danke']
        };

        for (const [lang, hints] of Object.entries(checks)) {
            for (const h of hints) {
                if (t.includes(h)) return lang;
            }
        }

        return 'en';
    }

    // Localize canonical status to a human label in the given language
    private localizeStatus(status: string, lang: string) {
        const map: { [k: string]: { [s: string]: string } } = {
            en: {
                'To Do': 'To Do',
                'In Progress': 'In Progress',
                Done: 'Done',
                Cancelled: 'Cancelled'
            },
            fr: {
                'To Do': "À faire",
                'In Progress': 'En cours',
                Done: 'Terminé',
                Cancelled: 'Annulé'
            },
            es: {
                'To Do': 'Por hacer',
                'In Progress': 'En progreso',
                Done: 'Hecho',
                Cancelled: 'Cancelado'
            },
            pt: {
                'To Do': 'A fazer',
                'In Progress': 'Em progresso',
                Done: 'Concluído',
                Cancelled: 'Cancelado'
            },
            de: {
                'To Do': 'Zu erledigen',
                'In Progress': 'In Bearbeitung',
                Done: 'Erledigt',
                Cancelled: 'Abgebrochen'
            }
        };

        const table = map[lang] || map.en;
        return table[status] || status;
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
