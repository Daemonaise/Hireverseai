/**
 * @fileOverview Centralized definitions for Genkit model objects.
 */

import { googleAI } from '@genkit-ai/google-genai';
import { openAI } from '@genkit-ai/openai';
import { anthropic, claude35Sonnet, claude3Haiku, claude3Opus } from 'genkitx-anthropic';

// Build model objects from each provider
export const MODEL_REGISTRY = {
  google: {
    flash: googleAI.model('gemini-1.5-flash'),
    pro: googleAI.model('gemini-1.5-pro'),
  },
  openai: {
    mini: openAI.model('gpt-4o-mini'),
    full: openAI.model('gpt-4o'),
  },
  anthropic: {
    haiku: claude3Haiku,
    sonnet: claude35Sonnet,
    opus: claude3Opus,
  },
} as const;

export const ALL_MODELS = {
  googleFast: MODEL_REGISTRY.google.flash,
  googlePro: MODEL_REGISTRY.google.pro,
  openaiMini: MODEL_REGISTRY.openai.mini,
  openaiFull: MODEL_REGISTRY.openai.full,
  anthropicHaiku: MODEL_REGISTRY.anthropic.haiku,
  anthropicSonnet: MODEL_REGISTRY.anthropic.sonnet,
  anthropicOpus: MODEL_REGISTRY.anthropic.opus,
};

// ---- TYPE HELPERS ----
export type Provider = keyof typeof MODEL_REGISTRY;
export type ModelKey<P extends Provider> = keyof (typeof MODEL_REGISTRY)[P];
export type ModelId = (typeof ALL_MODELS)[keyof typeof ALL_MODELS];
