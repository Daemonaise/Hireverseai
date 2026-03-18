/**
 * @fileoverview Centralized definitions for Genkit model objects.
 */

import { vertexAI } from '@genkit-ai/vertexai';
import { openAI } from '@genkit-ai/compat-oai/openai';
import { claude4Sonnet } from 'genkitx-anthropic';

// Model references — plugins are initialized once in ai.ts
export const MODEL_REGISTRY = {
  google: {
    flash: vertexAI.model('gemini-2.0-flash'),
  },
  openai: {
    mini: openAI.model('gpt-5-mini-2025-08-07'),
  },
  anthropic: {
    sonnet: claude4Sonnet,
  },
} as const;

// Flattened map for direct access to models
export const ALL_MODELS = {
  googleFlash: MODEL_REGISTRY.google.flash,
  openaiMini: MODEL_REGISTRY.openai.mini,
  anthropicSonnet: MODEL_REGISTRY.anthropic.sonnet,
};

// ---- TYPE HELPERS ----
export type Provider = keyof typeof MODEL_REGISTRY;
export type ModelKey<P extends Provider> = keyof (typeof MODEL_REGISTRY)[P];
export type ModelId = (typeof ALL_MODELS)[keyof typeof ALL_MODELS];
