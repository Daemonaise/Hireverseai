
import { ALL_MODELS, type ModelId } from '@/lib/ai-models';
import { LRUCache } from 'lru-cache';


// Read environment variables once at module load
const GOOGLE_CLOUD_PROJECT    = process.env.GOOGLE_CLOUD_PROJECT;
const OPENAI_API_KEY    = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Weights for scoring (tunable via env)
const SKILL_WEIGHT    = Number(process.env.SKILL_WEIGHT)    || 1;
const COST_WEIGHT     = Number(process.env.COST_WEIGHT)     || 1;
const LATENCY_WEIGHT  = Number(process.env.LATENCY_WEIGHT)  || 0.01;
// Cache size and token estimation
const CACHE_SIZE      = Number(process.env.CACHE_SIZE)      || 500;
const TOKEN_CHAR_RATIO= Number(process.env.TOKEN_CHAR_RATIO)|| 4;

// Features for semantic matching
const FEATURES = [
  { name: 'code',       keywords: ['code','\`\`\`','debug','script','api','function','typescript'], boosts: [] },
  { name: 'design',     keywords: ['design','image','graphic','visual','mockup','ui','ux'], boosts: [] },
  { name: 'analysis',   keywords: ['analysis','data','chart','report','statistics','table'], boosts: [{ threshold:1500, boost:2 }] },
  { name: 'creativity', keywords: ['story','creative','marketing','brand','poem','novel'], boosts: [{ threshold:800, boost:1 }] },
  { name: 'qa',         keywords: ['define','what is','who is','when is','explain','summary'], boosts: [] },
];

// LRU cache for feature extraction (keys hashed/truncated)
const featureCache = new LRUCache<string, Record<string, number>>({ max: CACHE_SIZE });

function normalizePrompt(text: unknown): string {
  if (typeof text !== 'string') return '';
  return text.trim().replace(/\s+/g, ' ');
}

// Simple hash for cache key to limit memory
function hashKey(str: string): string {
  let h = 0; for (const c of str) h = ((h << 5) - h) + c.charCodeAt(0), h |= 0;
  return h.toString();
}

function extractFeatures(raw: unknown): Record<string, number> {
  const text = normalizePrompt(raw);
  const key = hashKey(text);
  if (featureCache.has(key)) return featureCache.get(key)!;
  const counts: Record<string, number> = {};
  const lower = text.toLowerCase();
  for (const { name, keywords, boosts } of FEATURES) {
    let count = 0;
    for (const kw of keywords) {
      const matches = lower.match(new RegExp(`\\b${kw}\\b`, 'gi')); // Added word boundaries
      count += matches ? matches.length : 0;
    }
    for (const { threshold, boost } of boosts) {
      if (text.length > threshold) count += boost;
    }
    counts[name] = count;
  }
  featureCache.set(key, counts);
  return counts;
}

// Model profiles: proficiency, cost per token, average latency
interface Profile { proficiency: Record<string, number>; cost: number; latency: number }
const PROFILES: Record<string, Profile> = {
    [ALL_MODELS.googleFlash.name]: {
        proficiency: { code: 6, design: 5, analysis: 7, creativity: 6, qa: 8 },
        cost: 0.0005,
        latency: 70,
    },
    [ALL_MODELS.openaiMini.name]: {
        proficiency: { code: 9, design: 7, analysis: 8, creativity: 7, qa: 9 },
        cost: 0.001,
        latency: 150,
    },
    [ALL_MODELS.anthropicSonnet.name]: {
        proficiency: { code: 7, design: 6, analysis: 9, creativity: 8, qa: 7 },
        cost: 0.002,
        latency: 220,
    },
};


function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / TOKEN_CHAR_RATIO));
}

/**
 * Chooses an AI model based on prompt, balancing skill match, cost, and latency.
 * @returns A Promise resolving to the chosen ModelId.
 */
export async function chooseModelBasedOnPrompt(promptContent: string): Promise<ModelId> {
  const prompt = normalizePrompt(promptContent);
  const tokenCount = estimateTokens(prompt);
  const feats = extractFeatures(prompt);
  // determine available models
  const availableModels: ModelId[] = Array.from(new Set([ // Explicitly type here
    ...(GOOGLE_CLOUD_PROJECT    ? [ALL_MODELS.googleFlash] : []),
    ...(OPENAI_API_KEY    ? [ALL_MODELS.openaiMini] : []),
    ...(ANTHROPIC_API_KEY ? [ALL_MODELS.anthropicSonnet] : []),
  ]));

  if (availableModels.length === 0) {
    console.warn("[AI Model Choice] No API keys found. Defaulting to googleFlash. AI calls may fail.");
    return ALL_MODELS.googleFlash; // Default if no keys are set
  }

  let bestModel: ModelId = availableModels[0]; // Initialize with the first available model
  let bestScore = -Infinity;

  // scoring
  for (const model of availableModels) {
    const profile = PROFILES[model.name];
    if (!profile) {
        console.warn(`[AI Model Choice] Profile not found for model: ${model.name}. Skipping.`);
        continue;
    }
    const { proficiency, cost, latency } = profile;

    let skillScore = 0;
    for (const key in feats) {
        skillScore += (proficiency[key] || 0) * feats[key];
    }
    const costScore = cost * tokenCount;
    const latencyScore = latency;
    const score = SKILL_WEIGHT * skillScore - COST_WEIGHT * costScore - LATENCY_WEIGHT * latencyScore;
    
    // Tie-breaker: deterministic by model enum order (smaller index in ALL_MODELS is preferred)
    // This requires a way to get the "order" of models. For simplicity, if scores are equal,
    // the first one encountered that achieves that score (based on \`availableModels\` order) will be kept.
    // To make it fully deterministic by ALL_MODELS order, one might sort \`availableModels\` first by their
    // original order in ALL_MODELS.
    // For now, simple comparison is fine.
    if (score > bestScore) {
      bestScore = score;
      bestModel = model;
    }
  }
  // console.log(`[AI Model Choice] Prompt (first 50 chars): "${prompt.substring(0,50)}...", Chosen: ${bestModel.name}, Score: ${bestScore.toFixed(2)}\`);
  return bestModel;
}
