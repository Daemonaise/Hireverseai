/**
 * @fileoverview Centralized definitions for Genkit model objects using the latest patterns.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { openAI } from '@genkit-ai/compat-oai/openai';
import { anthropic, claude4Sonnet } from 'genkitx-anthropic';

// Initialize plugins
genkit({
  plugins: [googleAI(), openAI(), anthropic()],
});

// Define model references from the initialized plugins
export const MODEL_REGISTRY = {
  google: {
    flash: googleAI.model('gemini-flash-latest'),
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
