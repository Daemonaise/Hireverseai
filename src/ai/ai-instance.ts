'use server';
/**
 * @fileOverview Handles AI model selection and calls, currently configured for Gemini.
 */

import { z } from 'zod';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import fetch from 'node-fetch'; // Ensure fetch is available server-side

// --- Environment Variables ---
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Basic validation/warning (consider more robust error handling in production)
if (!GOOGLE_API_KEY) console.warn("Missing GOOGLE_API_KEY. AI features may be limited.");
// Optional: Add checks for other keys if you plan to enable other models
// if (!OPENAI_API_KEY) console.warn("Missing OPENAI_API_KEY");
// if (!ANTHROPIC_API_KEY) console.warn("Missing ANTHROPIC_API_KEY");


// --- Genkit (Google Gemini) Initialization ---
// REMOVED 'export' from 'ai' to comply with 'use server'
const ai = genkit({
  promptDir: './prompts',
  plugins: [googleAI({ apiKey: GOOGLE_API_KEY })],
  // Specify the default model to use if not overridden in prompts/flows
  model: 'googleai/gemini-1.5-flash-latest', // Updated to a generally available model
});

// REMOVED 'export' from 'chooseModelBasedOnPrompt' as it's not an async server action
function chooseModelBasedOnPrompt(promptContent: string): string {
  // Always return Gemini for now as other plugins are not configured
  console.log("Model selection defaulting to Gemini (plugins not configured).");
  return 'googleai/gemini-1.5-flash-latest';
}


// --- Decomposition Prompt (Google Gemini) ---
const PROJECT_DECOMPOSITION_PROMPT_TEXT = `
Decompose the following project brief into concrete steps required to get it done. Return your response in markdown format.
Project Brief: {{{brief}}}
`;

const projectDecompositionPrompt = ai.definePrompt({
  name: 'projectDecompositionPrompt',
  input: { schema: z.object({ brief: z.string() }) },
  output: { schema: z.string().describe('Decomposed project steps in markdown format.') },
  prompt: PROJECT_DECOMPOSITION_PROMPT_TEXT,
  config: { model: 'googleai/gemini-1.5-flash-latest' } // Using the default configured model
});

// --- Exported Async Functions (Server Actions) ---

// This function remains exported as it's intended to be called from client components
export async function decomposeProjectBrief(brief: string): Promise<string> {
  try {
    const { output } = await projectDecompositionPrompt({ brief });
    return output ?? "Failed to decompose project brief.";
  } catch (e: any) {
    console.error(`Error during decomposition:`, e.message ?? e);
    return "Failed to decompose project brief.";
  }
}

// This function remains exported as it's intended to be called from other server components/flows
export async function callAI(model: 'gemini' | 'gpt-4o' | 'claude-3', prompt: string): Promise<string> {
  // Ensure API keys are checked before attempting to use the model
  try {
      // Always use Gemini for now, ignore the 'model' parameter until other plugins are active
      console.log(`Calling Gemini (defaulting) for prompt: "${prompt.substring(0,50)}..."`);
      if (!GOOGLE_API_KEY) throw new Error('Google API Key is not configured.');

      // Using a simple dynamic prompt for Gemini calls within callAI
      // Note: For structured output, defining prompts statically like projectDecompositionPrompt is preferred.
      const dynamicGeminiPrompt = ai.definePrompt({
          name: `dynamicGeminiPrompt_${Date.now()}`, // Avoid name collisions
          input: { schema: z.object({ promptText: z.string() }) },
          output: { schema: z.string() },
          prompt: `{{{promptText}}}`,
          config: { model: 'googleai/gemini-1.5-flash-latest' }
      });
      const { output } = await dynamicGeminiPrompt({ promptText: prompt });
      return output ?? `Failed to generate with Gemini.`;

      // --- KEEPING PLACEHOLDER LOGIC FOR FUTURE USE ---
      // Placeholder implementations for OpenAI and Claude - require respective plugins and keys
      // if (model === 'gpt-4o') {
      //     if (!OPENAI_API_KEY) throw new Error('OpenAI API Key is not configured.');
      //     // Replace with actual Genkit OpenAI plugin call when configured
      //     console.warn('OpenAI call simulated, plugin not configured.');
      //     return `Simulated GPT-4o response for: ${prompt}`;
      // }

      // if (model === 'claude-3') {
      //     if (!ANTHROPIC_API_KEY) throw new Error('Anthropic API Key is not configured.');
      //     // Replace with actual Genkit Anthropic plugin call when configured
      //     console.warn('Claude call simulated, plugin not configured.');
      //      return `Simulated Claude-3 response for: ${prompt}`;
      // }

      // console.error(`Invalid model selection in callAI: ${model}`);
      // return "Invalid model selection.";

  } catch (error: any) {
      console.error(`Error calling AI model (${model}):`, error.message ?? error);
      // Provide a more specific error message if possible
      if (error.message.includes('API Key')) {
          return `Error: API Key missing or invalid for ${model}.`;
      }
      return `Error during AI generation with ${model}.`;
  }
}
