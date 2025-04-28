
/**
 * @fileOverview Handles AI model interactions, including dynamic model selection.
 * Currently configured only for Google Gemini models via Genkit.
 * Provides a unified interface for calling AI models.
 */

import { genkit, type ModelArgument } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod'; // Use standard zod import
import fetch from 'node-fetch'; // Ensure fetch is available server-side

// --- Environment Variables ---
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
// TODO: Uncomment when OpenAI/Anthropic plugins are properly configured and installed
// const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
// const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!GOOGLE_API_KEY) console.warn("Missing GOOGLE_API_KEY environment variable.");
// if (!OPENAI_API_KEY) console.warn("Missing OPENAI_API_KEY environment variable.");
// if (!ANTHROPIC_API_KEY) console.warn("Missing ANTHROPIC_API_KEY environment variable.");

// --- Genkit Initialization ---
// Initialize Genkit with only the Google AI plugin for now.
export const ai = genkit({
  plugins: [
    googleAI({ apiKey: GOOGLE_API_KEY }),
    // TODO: Add openai() and anthropic() plugins here when installed and configured
  ],
  logLevel: 'debug', // Or 'info'
  enableTracingAndMetrics: true,
});

// --- Dynamic Model Selection Logic ---
// Determines the appropriate model ID based on prompt content.
// Currently defaults to Gemini Flash as other models/plugins are not integrated.
export function chooseModelBasedOnPrompt(promptContent: string): string {
  const promptLength = promptContent.length;
  const promptLower = promptContent.toLowerCase();

  // Example logic (adjust thresholds and keywords as needed)
   if (promptLower.includes('graphic design') || promptLower.includes('visual critique') || promptLower.includes('logo') || promptLower.includes('illustration')) {
      // TODO: Use OpenAI when plugin is configured
      // return 'openai/gpt-4o'; // Hypothetical model name
       console.warn("OpenAI plugin not configured, defaulting to Gemini for graphic design task.");
       return 'googleai/gemini-1.5-flash-latest';
   }

  if (promptLength > 2000 || promptLower.includes('technical') || promptLower.includes('architecture') || promptLower.includes('code') || promptLower.includes('complex problem')) {
     // TODO: Use Anthropic when plugin is configured
     // return 'anthropic/claude-3-opus-20240229'; // Hypothetical model name
     console.warn("Anthropic plugin not configured, defaulting to Gemini for complex/long task.");
     return 'googleai/gemini-1.5-flash-latest'; // Use a more capable Gemini model for complex tasks
  }

  if (promptLower.includes('creative writing') || promptLower.includes('story') || promptLower.includes('ad copy') || promptLower.includes('marketing slogan')) {
     // TODO: Use OpenAI when plugin is configured
     // return 'openai/gpt-4o'; // Hypothetical model name
      console.warn("OpenAI plugin not configured, defaulting to Gemini for creative writing task.");
      return 'googleai/gemini-1.5-flash-latest';
  }

  // Default to Gemini Flash for general tasks or shorter prompts
  return 'googleai/gemini-1.5-flash-latest';
}


// --- Unified AI Caller ---
// This function acts as the central point for making AI calls.
// It selects a model (currently defaulting to Gemini) and uses Genkit's generate function.
export async function callAI(selectedModel: string, promptText: string): Promise<string> {
  try {
      // Ensure the selected model string is valid for Genkit's generate function
      // Currently, we only have Google models configured.
      const model = selectedModel as ModelArgument; // Cast might be needed depending on exact Genkit types

      console.log(`Calling AI model: ${model} with prompt (first 100 chars): ${promptText.substring(0, 100)}...`);

      const llmResponse = await genkit.generate({
        model: model, // Use the dynamically selected model ID
        prompt: promptText,
        config: {
          // Adjust temperature or other parameters as needed
           temperature: 0.7,
        },
        // No output schema specified here for flexibility, parsing happens in the calling flow
      });

      const textResponse = llmResponse.text();
      console.log(`AI Response received from ${model}. Length: ${textResponse?.length ?? 0}`);

      return textResponse ?? "No text response from AI.";

  } catch (error: any) {
      console.error(`Error calling AI model (${selectedModel}):`, error?.message ?? error);
      // Provide a more specific error message if possible
      let errorMessage = "Error during AI generation.";
      if (error.message?.includes('API key not valid')) {
          errorMessage = "AI generation failed due to an invalid API key.";
      } else if (error.message?.includes('quota')) {
          errorMessage = "AI generation failed due to exceeding API quota.";
      } else if (error.message) {
          errorMessage = `AI generation failed: ${error.message}`;
      }
      return errorMessage; // Return error message instead of generic failure
  }
}


// --- Placeholder for user-specific model lookup ---
// This function needs to be implemented with actual logic to fetch user-specific model IDs.
export function getUserSpecificModel(userId?: string): string | undefined {
    if (!userId) return undefined;
    console.log(`Checking for user-specific model for user: ${userId}`);
    // TODO: Implement logic to check database (e.g., Firestore) for a fine-tuned model ID associated with the userId.
    // Example (replace with actual DB lookup):
    // if (userId === 'test-freelancer-finetune') return 'your-fine-tuned-model-id';
    return undefined; // Always return undefined as fine-tuning is not implemented
}


// --- Example Simple Prompt/Flow (Kept for reference/testing if needed) ---
// This demonstrates a basic Genkit prompt definition but is not used by the main callAI function.
// const PROJECT_DECOMPOSITION_PROMPT_TEXT = `
// Decompose the following project brief into concrete steps required to get it done. Return your response in markdown format.
// Project Brief: {{{brief}}}
// `;

// const projectDecompositionPrompt = ai.definePrompt(
//   {
//     name: 'projectDecompositionPrompt',
//     input: { schema: z.object({ brief: z.string() }) },
//     output: { schema: z.string().describe('Decomposed project steps in markdown format.') },
//     model: 'googleai/gemini-1.5-flash-latest', // Specify a model here if using this prompt directly
//   },
//   PROJECT_DECOMPOSITION_PROMPT_TEXT
// );

// // --- Decompose Brief Function (Example of calling a specific prompt) ---
// export async function decomposeProjectBrief(brief: string): Promise<string> {
//   try {
//     const { output } = await projectDecompositionPrompt({ brief });
//     return output ?? "Failed to decompose project brief.";
//   } catch (e: any) {
//     console.error(`Error during decomposition:`, e.message ?? e);
//     return "Failed to decompose project brief.";
//   }
// }

// Note: Individual model callers (callGemini, callOpenAI, callClaude) using raw fetch are removed
// in favor of the unified Genkit-based callAI function.
