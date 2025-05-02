// src/lib/ai.ts
// This file should NOT have 'use server'

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { openAI } from 'genkitx-openai';
import { anthropic } from 'genkitx-anthropic';
import { z } from 'zod';

// --- Environment Variables (Read at initialization) ---
const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// --- AI Plugin Configuration ---
const plugins = [];

if (GOOGLE_API_KEY) {
  console.log("[AI Config] Google AI Plugin Added.");
  plugins.push(googleAI());
} else {
  console.warn("[AI Config] Google API Key missing, Google AI Plugin skipped.");
}

if (OPENAI_API_KEY) {
  console.log("[AI Config] OpenAI Plugin Added.");
  plugins.push(openAI());
} else {
  console.warn("[AI Config] OpenAI API Key missing, OpenAI Plugin skipped.");
}

if (ANTHROPIC_API_KEY) {
  console.log("[AI Config] Anthropic Plugin Added.");
  plugins.push(anthropic());
} else {
  console.warn("[AI Config] Anthropic API Key missing, Anthropic Plugin skipped.");
}

// --- AI Instance Configuration ---
export const ai = genkit({
  plugins,
  // logLevel: 'debug', // Uncomment for detailed Genkit logs
});

/**
 * Chooses an AI model based on the prompt's content and API key availability.
 * This function is synchronous and can be used without 'use server'.
 */
export function chooseModelBasedOnPrompt(promptContent: string): string {
  const promptLength = promptContent.length;
  const promptLower = promptContent.toLowerCase();
  const availableModels: string[] = [];
  const allModels = {
    google: 'googleai/gemini-1.5-flash', // Cost-effective baseline
    openai: ['openai/gpt-4o-mini', 'openai/gpt-4o'], // o3 mini high equivalent is likely gpt-4o-mini, keeping gpt-4o as option
    anthropic: ['anthropic/claude-3-haiku-20240307', 'anthropic/claude-3-5-sonnet-20240620'] // Haiku is cost-effective, Sonnet 3.5 is advanced
  };

  // Populate availableModels based on which keys are present
  if (GOOGLE_API_KEY)    availableModels.push(allModels.google);
  if (OPENAI_API_KEY)    availableModels.push(...allModels.openai);
  if (ANTHROPIC_API_KEY) availableModels.push(...allModels.anthropic);

  if (availableModels.length === 0) {
    console.error('[AI Model Selection] No models available due to missing API keys.');
    // Fallback or error based on requirements. Returning a default to avoid crashing.
    // Consider throwing an error if AI is critical: throw new Error('No AI models available.');
    return allModels.google; // Default fallback if possible
  }

  // Specific routing for coding/development to OpenAI o3 mini (gpt-4o-mini)
  if ( (promptLower.includes('code') || promptLower.includes('```') || promptLower.includes('debug') || promptLower.includes('development') || promptLower.includes('software') || promptLower.includes('scripting')) && availableModels.includes('openai/gpt-4o-mini') ) {
     console.log("[AI Model Selection] Choosing openai/gpt-4o-mini for coding/dev task.");
     return 'openai/gpt-4o-mini';
  }

  // Prioritize specific models based on keywords if available
  if ( (promptLower.includes('graphic design') || promptLower.includes('visual critique')) && availableModels.includes('openai/gpt-4o') ) { // Use full gpt-4o for visual tasks
    console.log("[AI Model Selection] Choosing openai/gpt-4o for graphic design.");
    return 'openai/gpt-4o';
  }
  if ( (promptLength > 1500 || promptLower.includes('analysis') || promptLower.includes('report')) && availableModels.includes('anthropic/claude-3-5-sonnet-20240620') ) {
    console.log("[AI Model Selection] Choosing anthropic/claude-3-5-sonnet-20240620 for long/analysis task.");
    return 'anthropic/claude-3-5-sonnet-20240620';
  }
  if ( (promptLower.includes('creative') || promptLower.includes('story') || promptLower.includes('marketing')) && availableModels.includes('anthropic/claude-3-5-sonnet-20240620') ) {
      console.log("[AI Model Selection] Choosing anthropic/claude-3-5-sonnet-20240620 for creative task.");
      return 'anthropic/claude-3-5-sonnet-20240620';
  }

  // Fallback logic - Prioritize Google AI Flash if available and no other specific match
  if (availableModels.includes(allModels.google)) {
    console.log("[AI Model Selection] Defaulting to googleai/gemini-1.5-flash.");
    return allModels.google; // Good general-purpose default
  }
  // Other cost-effective fallbacks
  if (availableModels.includes(allModels.anthropic[0])) { // Claude Haiku
     console.log("[AI Model Selection] Fallback to anthropic/claude-3-haiku-20240307.");
     return allModels.anthropic[0];
  }
  if (availableModels.includes(allModels.openai[0])) { // GPT-4o Mini
    console.log("[AI Model Selection] Fallback to openai/gpt-4o-mini.");
    return allModels.openai[0];
  }

  // If somehow none of the specific fallbacks match, return the first available
  console.warn("[AI Model Selection] No specific model match or preferred fallback found, returning first available:", availableModels[0]);
  return availableModels[0];
}

// --- Prompt Templates ---
// Put prompt definitions here.  They should NOT depend on 'use server'.
// Example:

import { z } from 'zod';

export const ProjectDecompositionInputSchema = z.object({
    projectBrief: z.string().min(20).describe('A detailed description of the project.'),
});
export type ProjectDecompositionInput = z.infer<typeof ProjectDecompositionInputSchema>;

export const ProjectDecompositionOutputSchema = z.object({
    microtasks: z.array(z.string()).describe('A list of microtasks to complete the project'),
});
export type ProjectDecompositionOutput = z.infer<typeof ProjectDecompositionOutputSchema>;
