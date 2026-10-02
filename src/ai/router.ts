import { GoogleGenAI } from '@google/genai';
import { config } from '../config/index.js';

export type ModelTier = 'tier1' | 'tier2' | 'tier3';

export type TaskComplexity = 
  | 'triage'
  | 'intent_classification'
  | 'stranger_screening'
  | 'quick_confirm'
  | 'name_disambiguation'
  | 'executive_chat'
  | 'draft_generation'
  | 'group_reply'
  | 'calendar_tasks_tool'
  | 'habit_checkin'
  | 'meeting_audio_synthesis'
  | 'strategic_debrief'
  | 'high_stakes_proposal';

export interface GenerateOptions {
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  tools?: any[];
}

/**
 * Autonomous Multi-Model Switching Architecture
 * Aggregates all high-quota Gemini models into cascading pools.
 * When one model reaches rate/daily quota limits (429) or is busy (503),
 * it automatically rotates to the next available model in real time.
 */
export const MODEL_POOLS: Record<ModelTier, string[]> = {
  // Ultra-fast, high-throughput triage & intent classification
  tier1: [
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash',
    'gemini-1.5-flash-8b',
    'gemini-1.5-flash'
  ],
  // Executive workhorse for drafts, chat, and reasoning
  tier2: [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-2.0-flash-lite'
  ],
  // Deep multimodal & strategic synthesis
  tier3: [
    'gemini-1.5-pro',
    'gemini-2.0-flash',
    'gemini-1.5-flash'
  ]
};

export class ModelRouter {
  private ai: GoogleGenAI | null = null;
  // Temporary cooldown timestamps for models that hit 429/503 limits (in ms)
  private modelCooldowns: Map<string, number> = new Map();

  constructor() {
    if (config.geminiApiKey) {
      this.ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
    }
  }

  /**
   * Determine the tier based on task complexity
   */
  public resolveTierForTask(task: TaskComplexity): ModelTier {
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
   * Get primary model identifier for tier
   */
  public getModelName(tier: ModelTier): string {
    return MODEL_POOLS[tier][0];
  }

  /**
   * Base system persona for Zerubbabel
   */
  public getDefaultSystemPrompt(): string {
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
   * Check if a model is currently in a cooldown window due to recent 429/503
   */
  private isModelCoolingDown(modelName: string): boolean {
    const expiresAt = this.modelCooldowns.get(modelName);
    if (!expiresAt) return false;
    if (Date.now() > expiresAt) {
      this.modelCooldowns.delete(modelName);
      return false;
    }
    return true;
  }

  private setModelCooldown(modelName: string, durationMs = 60000) {
    this.modelCooldowns.set(modelName, Date.now() + durationMs);
  }

  /**
   * Execute prompt with intelligent multi-model cascade switching
   */
  public async generate(
    tier: ModelTier,
    contents: any,
    options: GenerateOptions = {}
  ): Promise<{ text: string; actualTier: ModelTier; modelUsed: string }> {
    if (!this.ai) {
      if (!config.geminiApiKey) {
        throw new Error('GEMINI_API_KEY is not configured in .env');
      }
      this.ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
    }

    const systemInstruction = options.systemInstruction || this.getDefaultSystemPrompt();
    const candidateModels = [...MODEL_POOLS[tier]];

    // If preferred model is set in config, prioritize it at index 0
    const preferredConfig = tier === 'tier1' ? config.modelTier1Router : (tier === 'tier2' ? config.modelTier2Workhorse : config.modelTier3Deep);
    if (preferredConfig && !candidateModels.includes(preferredConfig)) {
      candidateModels.unshift(preferredConfig);
    }

    // Sort: models not on cooldown first
    const sortedCandidates = candidateModels.sort((a, b) => {
      const aCool = this.isModelCoolingDown(a) ? 1 : 0;
      const bCool = this.isModelCoolingDown(b) ? 1 : 0;
      return aCool - bCool;
    });

    let lastError: any = null;

    // Try every candidate in the pool
    for (const modelName of sortedCandidates) {
      if (this.isModelCoolingDown(modelName)) {
        console.warn(`⏳ [Multi-Model Switcher] Skipping ${modelName} (currently in cooldown).`);
        continue;
      }

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
      } catch (error: any) {
        lastError = error;
        const msg = error?.message || String(error);
        const isQuotaOrBusy = 
          error?.status === 429 || 
          error?.status === 503 || 
          error?.status === 404 ||
          msg.includes('429') || 
          msg.includes('503') || 
          msg.includes('404') ||
          msg.includes('RESOURCE_EXHAUSTED') || 
          msg.includes('UNAVAILABLE') || 
          msg.includes('high demand') ||
          msg.includes('no longer available') ||
          msg.includes('not found');

        if (isQuotaOrBusy) {
          // Put on 60 second cooldown so future calls skip this model instantly
          this.setModelCooldown(modelName, 60000);
          console.warn(`🔄 [Multi-Model Switcher] ${modelName} rate limited or unavailable (${error?.status || 'busy'}). Auto-switching to next candidate in pool...`);
          continue; // Seamlessly try the next model
        } else {
          // If it's another non-quota error, still attempt failover
          console.warn(`⚠️ [Multi-Model Switcher] Error on ${modelName}:`, msg);
          this.setModelCooldown(modelName, 30000);
          continue;
        }
      }
    }

    // If entire tier pool was exhausted, cascade to alternative tier pools!
    if (tier !== 'tier1') {
      console.warn(`🔄 [Multi-Model Switcher] All models in ${tier} exhausted. Cascading down to tier1 pool...`);
      return this.generate('tier1', contents, options);
    }

    throw lastError || new Error('All multi-model pool candidates currently rate-limited or unavailable.');
  }

  /**
   * High-level routing execution directly by task complexity
   */
  public async executeTask(
    task: TaskComplexity,
    prompt: string | any,
    options: GenerateOptions = {}
  ): Promise<{ text: string; actualTier: ModelTier; modelUsed: string }> {
    const tier = this.resolveTierForTask(task);
    return this.generate(tier, prompt, options);
  }

  /**
   * Return status of all model pools and active cooldowns
   */
  public getPoolStatus() {
    return {
      pools: MODEL_POOLS,
      cooldowns: Array.from(this.modelCooldowns.entries()).map(([model, time]) => ({
        model,
        cooldownRemainingSeconds: Math.max(0, Math.ceil((time - Date.now()) / 1000))
      }))
    };
  }
}

export const aiRouter = new ModelRouter();
