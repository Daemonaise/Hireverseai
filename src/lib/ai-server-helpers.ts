'use server'; // Ensure 'use server' is at the top

/**
 * @fileOverview Server-side helper functions for AI operations, including model selection.
 */

import { ALL_MODELS, type ModelId } from '@/lib/ai-models';

// Read environment variables once at the module level
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

/**
 * Chooses an AI model based on the prompt's content and API key availability.
 */
export async function chooseModelBasedOnPrompt(promptContent: string): Promise<ModelId> {
  const promptLength = promptContent.length;
  const promptLower = promptContent.toLowerCase();
  const availableModels: ModelId[] = [];

  // Populate availableModels based on which keys are present at call time
  if (GOOGLE_API_KEY) availableModels.push(ALL_MODELS.googleFast, ALL_MODELS.googlePro);
  if (OPENAI_API_KEY) availableModels.push(ALL_MODELS.openaiMini, ALL_MODELS.openaiFull);
  if (ANTHROPIC_API_KEY) availableModels.push(ALL_MODELS.anthropicHaiku, ALL_MODELS.anthropicSonnet, ALL_MODELS.anthropicOpus);

  if (availableModels.length === 0) {
    console.error('[AI Model Selection] No models available due to missing API keys. Defaulting to googleFast.');
    return ALL_MODELS.googleFast; // Default fallback if no keys are found
  }

  // --- Prioritized Routing Logic ---

  // 1. Coding/Development tasks to OpenAI GPT-4o Mini if available
  if (
    (promptLower.includes('code') ||
      promptLower.includes('```') ||
      promptLower.includes('debug') ||
      promptLower.includes('development') ||
      promptLower.includes('software') ||
      promptLower.includes('scripting')) &&
    availableModels.includes(ALL_MODELS.openaiMini)
  ) {
    console.log(`[AI Model Selection] Choosing ${ALL_MODELS.openaiMini} for coding/dev task.`);
    return ALL_MODELS.openaiMini;
  }

  // 2. Graphic design/visual critique to OpenAI GPT-4o Full if available
  if (
    (promptLower.includes('graphic design') || promptLower.includes('visual critique')) &&
    availableModels.includes(ALL_MODELS.openaiFull)
  ) {
    console.log(`[AI Model Selection] Choosing ${ALL_MODELS.openaiFull} for graphic design task.`);
    return ALL_MODELS.openaiFull;
  }

  // 3. Very long prompts or deep analysis/reports to Anthropic Opus if available
  if (
    (promptLength > 1500 || promptLower.includes('analysis') || promptLower.includes('report')) &&
    availableModels.includes(ALL_MODELS.anthropicOpus)
  ) {
    console.log(`[AI Model Selection] Choosing ${ALL_MODELS.anthropicOpus} for long/analysis task.`);
    return ALL_MODELS.anthropicOpus;
  }

  // 4. Creative tasks, marketing, or moderately long prompts to Anthropic Sonnet 3.5 if available
  if (
    (promptLower.includes('creative') ||
      promptLower.includes('story') ||
      promptLower.includes('marketing') ||
      promptLength > 1000) && // Using 1000 as a threshold for Sonnet
    availableModels.includes(ALL_MODELS.anthropicSonnet)
  ) {
    console.log(`[AI Model Selection] Choosing ${ALL_MODELS.anthropicSonnet} for creative/moderately long task.`);
    return ALL_MODELS.anthropicSonnet;
  }

  // 5. High-quality reasoning or complex problems to Google Gemini 1.5 Pro if available
  if (
    (promptLower.includes('reasoning') || promptLower.includes('complex problem')) &&
    availableModels.includes(ALL_MODELS.googlePro)
  ) {
    console.log(`[AI Model Selection] Choosing ${ALL_MODELS.googlePro} for reasoning task.`);
    return ALL_MODELS.googlePro;
  }

  // --- Fallback Model Selection (Prioritize cost-effectiveness and general capability) ---

  // Default general model: Anthropic Sonnet 3.5
  if (availableModels.includes(ALL_MODELS.anthropicSonnet)) {
    console.log(`[AI Model Selection] Defaulting to ${ALL_MODELS.anthropicSonnet}.`);
    return ALL_MODELS.anthropicSonnet;
  }
  // Next fallback: Google Gemini Pro (fast version)
  if (availableModels.includes(ALL_MODELS.googleFast)) {
    console.log(`[AI Model Selection] Fallback to ${ALL_MODELS.googleFast}.`);
    return ALL_MODELS.googleFast;
  }
  // Next fallback: OpenAI GPT-4o Mini
  if (availableModels.includes(ALL_MODELS.openaiMini)) {
    console.log(`[AI Model Selection] Fallback to ${ALL_MODELS.openaiMini}.`);
    return ALL_MODELS.openaiMini;
  }
  // Next fallback: Anthropic Haiku
  if (availableModels.includes(ALL_MODELS.anthropicHaiku)) {
    console.log(`[AI Model Selection] Fallback to ${ALL_MODELS.anthropicHaiku}.`);
    return ALL_MODELS.anthropicHaiku;
  }

  // If somehow none of the specific fallbacks match, return the first available model from the list
  // This should ideally not be reached if API keys are present.
  console.warn(
    `[AI Model Selection] No specific model match or preferred fallback found. Returning first available model: ${availableModels[0]}`
  );
  return availableModels[0];
}
