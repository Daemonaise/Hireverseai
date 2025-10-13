/**
 * @file Unified Genkit AI configuration
 * Compatible with current Genkit + Genkit-X model syntax.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { openAI } from '@genkit-ai/openai';
import { anthropic, claude35Sonnet } from 'genkitx-anthropic';

// --- Environment Variable Check ---
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

console.log(`[AI Config] GOOGLE_API_KEY present: ${!!GOOGLE_API_KEY}`);
console.log(`[AI Config] OPENAI_API_KEY present: ${!!OPENAI_API_KEY}`);
console.log(`[AI Config] ANTHROPIC_API_KEY present: ${!!ANTHROPIC_API_KEY}`);

// --- Plugin Configuration ---
const plugins = [];

if (GOOGLE_API_KEY) {
  console.log('[AI Config] Adding Google AI Plugin...');
  plugins.push(googleAI({ apiKey: GOOGLE_API_KEY }));
}

if (OPENAI_API_KEY) {
  console.log('[AI Config] Adding OpenAI Plugin...');
  plugins.push(openAI({ apiKey: OPENAI_API_KEY }));
}

if (ANTHROPIC_API_KEY) {
  console.log('[AI Config] Adding Anthropic Plugin...');
  plugins.push(anthropic({ apiKey: ANTHROPIC_API_KEY }));
}

if (plugins.length === 0) {
  console.error('[AI Config] CRITICAL: No AI plugins configured.');
  // In a real scenario, you might want to throw an error or use a mock plugin.
  // For this setup, we will proceed, but AI calls may fail.
}

// --- Create Genkit instance ---
export const ai = genkit({ plugins });

// --- Model identifiers ---
const geminiFlash = googleAI.model('gemini-1.5-flash');
const gpt4oMini = openAI.model('gpt-4o-mini');

// --- Chained cross-model orchestration example ---
export async function crossModelRoute(prompt: string): Promise<string> {
  try {
    // Step 1: Anthropic
    const { output: claudeOutput } = await ai.generate({
      model: claude35Sonnet,
      prompt,
    });
    const step1 = claudeOutput?.content[0].text ?? '';

    // Step 2: OpenAI
    const { output: gptOutput } = await ai.generate({
      model: gpt4oMini,
      prompt: step1,
    });
    const step2 = gptOutput?.content[0].text ?? '';

    // Step 3: Google
    const { output: geminiOutput } = await ai.generate({
      model: geminiFlash,
      prompt: step2,
    });
    return geminiOutput?.content[0].text ?? '';
  } catch (err) {
    console.error('[AI Flow Error]', err);
    throw err;
  }
}
