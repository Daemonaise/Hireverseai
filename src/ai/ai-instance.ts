'use server';
/**
 * @fileOverview Defines the Genkit AI instance, external AI calls, and intelligent project decomposition with dynamic model selection.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'genkit';
import fetch from 'node-fetch'; // Keep fetch if needed elsewhere, but callAI is removed

// --- Environment Variables ---
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
// Keep these for potential future plugin integration
// const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
// const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!GOOGLE_API_KEY) {
  console.warn("Missing GOOGLE_API_KEY in environment variables.");
}

// --- Genkit (Google Gemini) Initialization ---
export const ai = genkit({
  promptDir: './prompts', // This might not be used if prompts are defined inline
  plugins: [googleAI({ apiKey: GOOGLE_API_KEY })],
  // Set a sensible default model
  // model: 'googleai/gemini-1.5-flash-latest', // Use a specific Gemini model if preferred
});

// --- Project Decomposition Prompt for Gemini (Example, keep if used elsewhere directly) ---
const PROJECT_DECOMPOSITION_PROMPT_TEXT = `
Decompose the following project brief into concrete steps required to get it done. Return your response in markdown format.
Project Brief: {{{brief}}}
`;

const projectDecompositionPrompt = ai.definePrompt({
  name: 'projectDecompositionPrompt',
  input: { schema: z.object({ brief: z.string() }) },
  output: { schema: z.string().describe('Decomposed project steps in markdown format.') },
  prompt: PROJECT_DECOMPOSITION_PROMPT_TEXT,
  // Specify model explicitly if not relying on genkit default
  config: { model: 'googleai/gemini-1.5-flash-latest' }
});

// --- Decompose Project Brief (Gemini - Example Function) ---

export async function decomposeProjectBrief(brief: string): Promise<string> {
  try {
    const { output } = await projectDecompositionPrompt({ brief }); // Use default model from prompt definition
    return output ?? "Failed to decompose project brief.";
  } catch (e: any) {
    console.error(`Error during decomposition:`, e.message);
    return "Failed to decompose project brief.";
  }
}

// --- Placeholder for user-specific model (Not implemented) ---
// Made async to comply with 'use server' export rules
export async function getUserSpecificModel(userId: string): Promise<string | undefined> {
  console.log(`Checking for user-specific model for user ${userId}... (not implemented)`);
  // In a real implementation, this would query Firestore or another DB
  // for a fine-tuned model ID associated with the userId.
  // Example:
  // const userProfile = await getUserProfile(userId);
  // if (userProfile?.fineTunedModelId) return userProfile.fineTunedModelId;
  return undefined; // Default: No user-specific model found
}


// --- Smart Model Chooser based on Prompt Content ---
// Returns a Genkit-compatible model string.
// Note: Currently only returns Gemini as other plugins are not configured.
// Made async to comply with 'use server' export rules
export async function chooseModelBasedOnPrompt(promptContent: string): Promise<string> {
  const promptLength = promptContent.length;
  const promptLower = promptContent.toLowerCase();

  // Example logic (adjust thresholds and keywords as needed)
   if (promptLower.includes('graphic design') || promptLower.includes('visual critique') || promptLower.includes('logo') || promptLower.includes('illustration')) {
      // TODO: Uncomment and use when OpenAI plugin is configured
      // return 'openai/gpt-4o'; // Hypothetical model name
      console.warn("OpenAI plugin not configured, defaulting to Gemini for graphic design task.");
      return 'googleai/gemini-1.5-flash-latest';
   }

  if (promptLength > 2000 || promptLower.includes('technical') || promptLower.includes('architecture') || promptLower.includes('code') || promptLower.includes('complex problem')) {
     // TODO: Uncomment and use when Anthropic plugin is configured
     // return 'anthropic/claude-3-opus-20240229'; // Hypothetical model name
     console.warn("Anthropic plugin not configured, defaulting to Gemini for complex/long task.");
     return 'googleai/gemini-1.5-flash-latest'; // Use a more capable Gemini model for complex tasks
  }

  if (promptLower.includes('creative writing') || promptLower.includes('story') || promptLower.includes('ad copy') || promptLower.includes('marketing slogan')) {
     // TODO: Uncomment and use when OpenAI plugin is configured
     // return 'openai/gpt-4o'; // Hypothetical model name
      console.warn("OpenAI plugin not configured, defaulting to Gemini for creative writing task.");
      return 'googleai/gemini-1.5-flash-latest';
  }

  // Default to Gemini Flash for general tasks or shorter prompts
  return 'googleai/gemini-1.5-flash-latest';
}

// --- Removed callAI function ---
// The logic is now intended to be used within each flow by calling chooseModelBasedOnPrompt
// and passing the result to the ai.definePrompt call.


