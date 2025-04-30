


/**
 * ai-instance.ts
 *
 * Initializes Genkit with configured AI plugins (Google Gemini)
 * and provides static prompts and helper functions for decomposition and other tasks.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai'; // Corrected import
// import { openAI } from 'genkitx-openai'; // Keep commented out as other plugins are not used
// import { anthropic } from 'genkitx-anthropic'; // Keep commented out
import { z } from 'zod'; // Use standard Zod import

// --- Environment Variables ---
const GOOGLE_API_KEY    = process.env.GOOGLE_API_KEY;
// const OPENAI_API_KEY    = process.env.OPENAI_API_KEY;
// const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// --- Warn if keys are missing ---
if (!GOOGLE_API_KEY)    console.warn('[AI] Missing GOOGLE_API_KEY — Gemini will not function.');
// if (!OPENAI_API_KEY)    console.warn('[AI] Missing OPENAI_API_KEY — OpenAI will not function.');
// if (!ANTHROPIC_API_KEY) console.warn('[AI] Missing ANTHROPIC_API_KEY — Anthropic will not function.');

// --- Genkit Initialization ---
const plugins = [];
if (GOOGLE_API_KEY)    plugins.push(googleAI({ apiKey: GOOGLE_API_KEY }));
// if (OPENAI_API_KEY)    plugins.push(openAI({ apiKey: OPENAI_API_KEY }));
// if (ANTHROPIC_API_KEY) plugins.push(anthropic({ apiKey: ANTHROPIC_API_KEY }));

if (plugins.length === 0) {
  console.error('[AI] No AI plugins configured — all calls will fail.');
}

// Export the ai instance (Genkit object) - allowed now without 'use server'
export const ai = genkit({
  promptDir: './prompts',
  logLevel: 'info',
  plugins,
  // model: 'googleai/gemini-1.5-flash', // Default model removed to use dynamic selection
});

// --- Helper: Decompose Project Brief into Steps ---
const DecompInputSchema = z.object({ brief: z.string() });
const DecompOutputSchema = z.string().describe('Markdown steps');

// Export the prompt object - allowed now without 'use server'
export const projectDecompositionPrompt = ai.definePrompt({
  name:  'projectDecomposition',
  model: GOOGLE_API_KEY ? 'googleai/gemini-1.5-flash' : undefined, // Use the only available model
  input: { schema: DecompInputSchema },
  output:{ schema: DecompOutputSchema },
  prompt: ({ brief }) =>
    `Decompose the following project brief into ordered steps (markdown):\n${brief}`,
});

/**
 * Breaks a free-form brief into a markdown checklist of tasks.
 * @param brief The project brief text.
 * @returns A markdown-formatted list of steps or error message.
 */
// Export the async function - allowed now without 'use server'
// Note: This function itself could be a server action if moved to a 'use server' file,
// but here it's just a regular async function using the exported prompt.
export async function decomposeProjectBrief(brief: string): Promise<string> {
  if (!projectDecompositionPrompt) {
    return '🔴 AI configuration error: No decomposition prompt available.';
  }
  try {
    const { output } = await projectDecompositionPrompt({ brief });
    // Ensure output is not null/undefined before returning
    return output ?? "AI failed to decompose the brief.";
  } catch (err: any) {
    console.error('[AI] Decomposition error:', err.message);
    return `❗ Decomposition failed: ${err.message}`;
  }
}

// Note: Removed chooseModelBasedOnPrompt and callAI as they were part of the multi-model logic.
// Also removed fine-tuning related comments/functions as they are not implemented.
