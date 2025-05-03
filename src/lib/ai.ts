// This file configures the Genkit instance and should NOT use 'use server'

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { openAI } from 'genkitx-openai';
import { anthropic } from 'genkitx-anthropic';

// --- AI Plugin Configuration ---
// Plugins are initialized when the module loads.
const plugins = [];

// Add plugins conditionally based on key presence *at initialization*
// This determines if the plugin is even available to Genkit.
const GOOGLE_API_KEY_INIT = process.env.GOOGLE_API_KEY;
const OPENAI_API_KEY_INIT = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY_INIT = process.env.ANTHROPIC_API_KEY;

if (GOOGLE_API_KEY_INIT) {
  console.log("[AI Config] Google AI Plugin Added.");
  plugins.push(googleAI());
} else {
  console.warn("[AI Config] Google API Key missing, Google AI Plugin skipped.");
}

if (OPENAI_API_KEY_INIT) {
  console.log("[AI Config] OpenAI Plugin Added.");
  plugins.push(openAI());
} else {
  console.warn("[AI Config] OpenAI API Key missing, OpenAI Plugin skipped.");
}

if (ANTHROPIC_API_KEY_INIT) {
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

// Removed chooseModelBasedOnPrompt function - moved to src/lib/ai-server-helpers.ts
