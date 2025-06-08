/**
 * @fileOverview Centralized definitions for AI model identifiers and related types.
 */

// Using 'as const' to get literal types for values and enable keyof typeof for ModelId
export const ALL_MODELS = {
  // Google AI Models
  googleFast: 'googleai/gemini-pro', // General purpose, fast
  googlePro: 'googleai/gemini-1.5-pro', // Higher quality, larger context

  // OpenAI Models
  openaiMini: 'openai/gpt-4o-mini', // Cost-effective, fast
  openaiFull: 'openai/gpt-4o', // Most capable OpenAI model

  // Anthropic Models (using specific versions for stability)
  anthropicHaiku: 'anthropic/claude-3-haiku-20240307',
  anthropicSonnet: 'anthropic/claude-3.5-sonnet-20240620',
  anthropicOpus: 'anthropic/claude-3-opus-20240229',
} as const;

// Type representing the valid model identifier strings
export type ModelId = typeof ALL_MODELS[keyof typeof ALL_MODELS];

// Type representing the keys of the ALL_MODELS object (e.g., "googleFast", "openaiMini")
export type ModelKey = keyof typeof ALL_MODELS;
