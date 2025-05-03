// This file configures the Genkit instance and should NOT use 'use server'

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { openAI } from 'genkitx-openai';
import { anthropic } from 'genkitx-anthropic';

// --- Environment Variable Check ---
// Read keys at initialization to confirm availability.
const GOOGLE_API_KEY_INIT = process.env.GOOGLE_API_KEY;
const OPENAI_API_KEY_INIT = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY_INIT = process.env.ANTHROPIC_API_KEY;

// Log presence/absence of keys for debugging
console.log(`[AI Config] GOOGLE_API_KEY present: ${!!GOOGLE_API_KEY_INIT}`);
console.log(`[AI Config] OPENAI_API_KEY present: ${!!OPENAI_API_KEY_INIT}`);
console.log(`[AI Config] ANTHROPIC_API_KEY present: ${!!ANTHROPIC_API_KEY_INIT}`);


// --- AI Plugin Configuration ---
// Plugins are initialized when the module loads.
const plugins = [];

// Add plugins conditionally based on key presence *at initialization*
// This determines if the plugin is even available to Genkit.
if (GOOGLE_API_KEY_INIT) {
  console.log("[AI Config] Adding Google AI Plugin...");
  try {
    plugins.push(googleAI()); // Pass API key if required by specific plugin version, otherwise it reads from env
    console.log("[AI Config] Google AI Plugin Added.");
  } catch (e: any) {
    console.error("[AI Config] Error initializing Google AI Plugin:", e.message);
  }
} else {
  console.warn("[AI Config] Google API Key missing, Google AI Plugin skipped.");
}

if (OPENAI_API_KEY_INIT) {
  console.log("[AI Config] Adding OpenAI Plugin...");
   try {
    // Pass the key directly during initialization if the plugin requires it
    plugins.push(openAI({ apiKey: OPENAI_API_KEY_INIT }));
    console.log("[AI Config] OpenAI Plugin Added.");
  } catch (e: any) {
    console.error("[AI Config] Error initializing OpenAI Plugin:", e.message);
  }
} else {
  console.warn("[AI Config] OpenAI API Key missing, OpenAI Plugin skipped.");
}

if (ANTHROPIC_API_KEY_INIT) {
  console.log("[AI Config] Adding Anthropic Plugin...");
  try {
     // Pass the key directly during initialization if the plugin requires it
     plugins.push(anthropic({ apiKey: ANTHROPIC_API_KEY_INIT }));
     console.log("[AI Config] Anthropic Plugin Added.");
   } catch (e: any) {
     console.error("[AI Config] Error initializing Anthropic Plugin:", e.message);
   }
} else {
  console.warn("[AI Config] Anthropic API Key missing, Anthropic Plugin skipped.");
}

if (plugins.length === 0) {
    console.error("[AI Config] CRITICAL: No AI plugins were configured due to missing API keys. AI functionality will likely fail.");
    // Consider throwing an error here if AI is essential for the app to function
    // throw new Error("No AI plugins configured. Please provide at least one API key.");
}

// --- AI Instance Configuration ---
// Only export the 'ai' instance from this file.
export const ai = genkit({
  plugins,
  // logLevel: 'debug', // Uncomment for detailed Genkit logs
});

// Moved chooseModelBasedOnPrompt function to src/lib/ai-server-helpers.ts
// Moved validateAIOutput function to src/ai/validate-output.ts
