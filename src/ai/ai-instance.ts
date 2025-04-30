


/**
 * ai-instance.ts
 *
 * Initializes Genkit with configured AI plugins (Google Gemini, OpenAI, Anthropic)
 * and provides helper functions for model selection and decomposition.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai'; // Correct import
import { openAI } from 'genkitx-openai'; // Correct import for OpenAI
import { anthropic } from 'genkitx-anthropic'; // Correct import for Anthropic
import { z } from 'zod'; // Use standard Zod import

// --- Environment Variables ---
const GOOGLE_API_KEY    = process.env.GOOGLE_API_KEY;
const OPENAI_API_KEY    = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// --- Warn if keys are missing ---
if (!GOOGLE_API_KEY)    console.warn('[AI] Missing GOOGLE_API_KEY — Gemini will not function.');
if (!OPENAI_API_KEY)    console.warn('[AI] Missing OPENAI_API_KEY — OpenAI will not function.');
if (!ANTHROPIC_API_KEY) console.warn('[AI] Missing ANTHROPIC_API_KEY — Anthropic will not function.');

// --- Genkit Initialization ---
const plugins = [];
// Add plugins conditionally based on API key presence
if (GOOGLE_API_KEY)    plugins.push(googleAI({ apiKey: GOOGLE_API_KEY }));
if (OPENAI_API_KEY)    plugins.push(openAI({ apiKey: OPENAI_API_KEY }));
if (ANTHROPIC_API_KEY) plugins.push(anthropic({ apiKey: ANTHROPIC_API_KEY }));

if (plugins.length === 0) {
  console.error('[AI] No AI plugins configured — all calls will fail.');
}

// Export the ai instance (Genkit object)
export const ai = genkit({
  promptDir: './prompts',
  logLevel: 'info',
  plugins,
  // Default model removed - flows will select dynamically
});

// --- Helper: Choose Model Based on Prompt Content ---
/**
 * Selects the most appropriate AI model based on keywords or characteristics of the prompt content.
 * @param promptContent The text content to analyze for model selection.
 * @returns The name of the recommended Genkit model string (e.g., 'googleai/gemini-1.5-flash').
 */
// This function is NOT a server action itself, but a utility used by server actions.
// It does not need 'use server'.
export function chooseModelBasedOnPrompt(promptContent: string): string {
  const promptLength = promptContent.length;
  const promptLower = promptContent.toLowerCase();

  // 1. Prioritize models based on available API keys
  // 2. Use keywords to select the *best available* model

  if (ANTHROPIC_API_KEY && (promptLength > 2000 || promptLower.includes('technical') || promptLower.includes('architecture') || promptLower.includes('code') || promptLower.includes('complex problem'))) {
    console.log("[AI] Choosing Anthropic (Claude) for complex/long task.");
    return 'anthropic/claude-3-5-sonnet-20240620'; // Use the specific model identifier
  }

  if (OPENAI_API_KEY && (promptLower.includes('graphic design') || promptLower.includes('visual critique') || promptLower.includes('logo') || promptLower.includes('illustration') || promptLower.includes('creative writing') || promptLower.includes('story') || promptLower.includes('ad copy') || promptLower.includes('marketing slogan'))) {
    console.log("[AI] Choosing OpenAI (GPT-4o) for creative/visual task.");
    return 'openai/gpt-4o'; // Use the specific model identifier
  }

  // Default to Gemini if Google key exists or if no other specific match
  if (GOOGLE_API_KEY) {
    console.log("[AI] Choosing Google (Gemini Flash) as default or best fit.");
    return 'googleai/gemini-1.5-flash'; // Default Gemini model
  }

  // Fallback if NO keys are available (though initialization should prevent this)
  console.error("[AI] No suitable AI model could be determined or configured. Returning placeholder.");
  return 'googleai/gemini-1.5-flash'; // Return a placeholder, but calls will likely fail
}


// --- Helper: Decompose Project Brief into Steps ---
// This prompt definition uses the default model unless overridden
const DecompInputSchema = z.object({ brief: z.string() });
const DecompOutputSchema = z.string().describe('Markdown steps');

// Define the prompt statically, model selection happens in the calling function
export const projectDecompositionPrompt = ai.definePrompt({
  name:  'projectDecomposition',
  // Model is NOT set here; it will be chosen dynamically in decomposeProjectBrief
  input: { schema: DecompInputSchema },
  output:{ schema: DecompOutputSchema },
  prompt: ({ brief }) =>
    `Decompose the following project brief into ordered steps (markdown):\n${brief}`,
});

/**
 * Breaks a free-form brief into a markdown checklist of tasks.
 * Uses dynamic model selection.
 * @param brief The project brief text.
 * @returns A markdown-formatted list of steps or error message.
 */
// This function IS intended to be callable from the client/server components,
// but it's an async utility, not a 'use server' action itself unless moved.
// If called directly from client components, the file it's in needs 'use server'.
// However, it's better practice for specific *flows* to have 'use server'.
// Let's assume this is primarily a backend utility for now.
export async function decomposeProjectBrief(brief: string): Promise<string> {
  // Choose model dynamically
  const selectedModel = chooseModelBasedOnPrompt(brief);
  console.log(`[AI Decompose] Using model: ${selectedModel}`);

  try {
     // Invoke the prompt, specifying the dynamically chosen model
     const { output } = await projectDecompositionPrompt({ brief }, { model: selectedModel });
     return output ?? "AI failed to decompose the brief.";
  } catch (err: any) {
    console.error('[AI Decompose] Error:', err.message);
    return `❗ Decomposition failed: ${err.message}`;
  }
}

// Note: The 'callAI' function is removed as flows should use chooseModelBasedOnPrompt
// and then call ai.definePrompt({..., model: selectedModel, ...}) directly.
