
// Keep imports minimal: genkit core, plugins, zod
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { openAI } from 'genkitx-openai';
import { anthropic } from 'genkitx-anthropic';
import { z } from 'zod';

// --- Environment Variables ---
// These are accessed at runtime within chooseModelBasedOnPrompt
const GOOGLE_API_KEY    = process.env.GOOGLE_API_KEY;
const OPENAI_API_KEY    = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// --- AI Plugin Configuration ---
// Plugins are initialized when the module loads.
const plugins = [];

// Add plugins unconditionally. API key presence is checked at call time or by the plugin itself.
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

// Initialize Genkit with configured plugins
// Export the 'ai' instance
export const ai = genkit({
  plugins,
  // logLevel: 'debug', // Uncomment for detailed Genkit logs
});


// --- Model Selection Logic ---
// This function is synchronous and can be exported without 'use server' problems
// It returns a Genkit-compatible model string (e.g., 'googleai/gemini-1.5-flash').
export function chooseModelBasedOnPrompt(promptContent: string): string {
  // Re-evaluate API keys at runtime inside the function
  const GOOGLE_API_KEY_RUNTIME    = process.env.GOOGLE_API_KEY;
  const OPENAI_API_KEY_RUNTIME    = process.env.OPENAI_API_KEY;
  const ANTHROPIC_API_KEY_RUNTIME = process.env.ANTHROPIC_API_KEY;

  const promptLength = promptContent.length;
  const promptLower = promptContent.toLowerCase();
  const availableModels: string[] = [];

  // Populate availableModels based on which keys are present *at call time*
  if (GOOGLE_API_KEY_RUNTIME)    availableModels.push('googleai/gemini-1.5-flash');
  if (OPENAI_API_KEY_RUNTIME)    availableModels.push('openai/gpt-4o', 'openai/gpt-3.5-turbo');
  if (ANTHROPIC_API_KEY_RUNTIME) availableModels.push('anthropic/claude-3-5-sonnet-20240620', 'anthropic/claude-3-haiku-20240307');

  if (availableModels.length === 0) {
    console.error('[AI Model Selection] No models available due to missing API keys.');
    // Fallback or error based on requirements. Returning a default to avoid crashing.
    // Consider throwing an error if AI is critical: throw new Error('No AI models available.');
    return 'googleai/gemini-1.5-flash'; // Default fallback if possible
  }

  // Prioritize specific models based on keywords if available
  if ( (promptLower.includes('graphic design') || promptLower.includes('visual critique')) && availableModels.includes('openai/gpt-4o') ) {
    console.log("[AI Model Selection] Choosing openai/gpt-4o for graphic design.");
    return 'openai/gpt-4o';
  }
  if ( (promptLower.includes('code') || promptLower.includes('```') || promptLower.includes('debug')) && availableModels.includes('openai/gpt-4o') ) {
     console.log("[AI Model Selection] Choosing openai/gpt-4o for code task.");
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

  // Fallback logic - Prioritize Google AI if available and no other specific match
  if (availableModels.includes('googleai/gemini-1.5-flash')) {
    console.log("[AI Model Selection] Defaulting to googleai/gemini-1.5-flash.");
    return 'googleai/gemini-1.5-flash'; // Good general-purpose default
  }
  // Other fallbacks if Google isn't available
  if (availableModels.includes('anthropic/claude-3-haiku-20240307')) {
     console.log("[AI Model Selection] Fallback to anthropic/claude-3-haiku-20240307.");
     return 'anthropic/claude-3-haiku-20240307'; // Faster/cheaper alternative
  }
  if (availableModels.includes('openai/gpt-3.5-turbo')) {
    console.log("[AI Model Selection] Fallback to openai/gpt-3.5-turbo.");
    return 'openai/gpt-3.5-turbo'; // Another fallback
  }

  // If somehow none of the specific fallbacks match, return the first available
  console.warn("[AI Model Selection] No specific model match or preferred fallback found, returning first available:", availableModels[0]);
  return availableModels[0];
}

// --- Removed callAI function ---
// The logic including cross-validation needs to be reimplemented at a higher level,
// possibly within specific flows or a dedicated validation utility if required.
// Individual flows will now directly use `ai.generate()` or defined prompts.

// --- Removed Prompt Definitions ---
// Prompt definitions (like validationPrompt) should live closer to where they are used,
// typically within the specific flow file or a shared prompts module.

// --- Fine-tuning placeholders removed ---
// Fine-tuning logic (getUserFineTunedModel, triggerFineTuningJob) is complex
// and requires significant infrastructure beyond basic API calls.
// It would typically involve dedicated services and asynchronous job handling.
