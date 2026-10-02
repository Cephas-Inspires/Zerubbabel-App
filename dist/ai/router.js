import { GoogleGenAI } from '@google/genai';
import { config } from '../config/index.js';
export class ModelRouter {
    ai = null;
    constructor() {
        if (config.geminiApiKey) {
            this.ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
        }
    }
    /**
     * Determine the tier based on task complexity
     */
    resolveTierForTask(task) {
        switch (task) {
            case 'triage':
            case 'intent_classification':
            case 'stranger_screening':
            case 'quick_confirm':
            case 'name_disambiguation':
                return 'tier1';
            case 'executive_chat':
            case 'draft_generation':
            case 'group_reply':
            case 'calendar_tasks_tool':
            case 'habit_checkin':
                return 'tier2';
            case 'meeting_audio_synthesis':
            case 'strategic_debrief':
            case 'high_stakes_proposal':
                return 'tier3';
            default:
                return 'tier2';
        }
    }
    /**
     * Get model identifier for tier
     */
    getModelName(tier) {
        switch (tier) {
            case 'tier1':
                return config.modelTier1Router;
            case 'tier2':
                return config.modelTier2Workhorse;
            case 'tier3':
                return config.modelTier3Deep;
        }
    }
    /**
     * Base system persona for Zerubbabel
     */
    getDefaultSystemPrompt() {
        return `You are Zerubbabel, an elite autonomous AI Executive Assistant and Chief of Staff built exclusively for Cephas (Founder & Strategic Leader).
You operate with the highest level of agency, strategic clarity, conciseness, and precision.

Key Operating Rules:
1. Tone: Professional, articulate, proactive, structured, and confident.
2. Safety: You NEVER send external messages autonomously. You draft messages with Cephas's approved signature and stage them for his explicit review.
3. Outbound Signature: Always sign external WhatsApp messages with:
"${config.outboundSignature}"
4. Efficiency: Prioritize actionable executive summaries, bulleted decisions, and clear deadlines.`;
    }
    /**
     * Execute prompt with specified tier and automatic failover
     */
    async generate(tier, contents, options = {}) {
        if (!this.ai) {
            if (!config.geminiApiKey) {
                throw new Error('GEMINI_API_KEY is not configured in .env');
            }
            this.ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
        }
        const modelName = this.getModelName(tier);
        const systemInstruction = options.systemInstruction || this.getDefaultSystemPrompt();
        try {
            const response = await this.ai.models.generateContent({
                model: modelName,
                contents,
                config: {
                    systemInstruction,
                    temperature: options.temperature ?? (tier === 'tier1' ? 0.2 : 0.7),
                    maxOutputTokens: options.maxOutputTokens
                }
            });
            return {
                text: response.text || '',
                actualTier: tier,
                modelUsed: modelName
            };
        }
        catch (error) {
            console.warn(`⚠️ [AI Router] Warning on ${tier} (${modelName}):`, error?.message || error);
            // Automatic failover logic on rate limit (429), server capacity (503), quota exceeded, or model not found (404)
            const shouldFailover = error?.status === 429 ||
                error?.status === 503 ||
                error?.status === 404 ||
                error?.message?.includes('429') ||
                error?.message?.includes('503') ||
                error?.message?.includes('404') ||
                error?.message?.includes('not found') ||
                error?.message?.includes('no longer available') ||
                error?.message?.includes('RESOURCE_EXHAUSTED') ||
                error?.message?.includes('UNAVAILABLE') ||
                error?.message?.includes('high demand');
            if (shouldFailover) {
                if (tier === 'tier3') {
                    console.warn('🔄 [AI Router] Failing over from Tier 3 to Tier 2 (gemini-3.8-flash)...');
                    return this.generate('tier2', contents, options);
                }
                else if (tier === 'tier2') {
                    console.warn('🔄 [AI Router] Failing over from Tier 2 to Tier 1 (gemini-3.5-flash-lite)...');
                    return this.generate('tier1', contents, options);
                }
                else if (tier === 'tier1' && modelName !== 'gemini-3.5-flash-lite') {
                    console.warn('🔄 [AI Router] Failing over from Tier 1 to gemini-3.5-flash-lite...');
                    return this.ai.models.generateContent({
                        model: 'gemini-3.5-flash-lite',
                        contents,
                        config: {
                            systemInstruction,
                            temperature: options.temperature ?? 0.2,
                            maxOutputTokens: options.maxOutputTokens
                        }
                    }).then(res => ({
                        text: res.text || '',
                        actualTier: 'tier1',
                        modelUsed: 'gemini-3.5-flash-lite'
                    }));
                }
            }
            throw error;
        }
    }
    /**
     * High-level routing execution directly by task complexity
     */
    async executeTask(task, prompt, options = {}) {
        const tier = this.resolveTierForTask(task);
        return this.generate(tier, prompt, options);
    }
}
export const aiRouter = new ModelRouter();
