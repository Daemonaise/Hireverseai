
/**
 * @fileOverview Defines the Genkit AI instance and associated prompts/logic.
 * Configures the AI models and provides helper functions for project decomposition.
 *
 * Exports:
 * - ai: The initialized Genkit instance.
 * - decomposeProjectBrief: Function to decompose a project brief using AI.
 * - getUserSpecificModel: Placeholder function to check for user-specific models.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'genkit'; // Use genkit's zod export

// --- API Key Check ---
// Read API key from environment variables
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
if (!GOOGLE_API_KEY) {
  console.warn("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
  console.warn("!!! WARNING: GOOGLE_API_KEY environment variable is missing or empty.      !!!");
  console.warn("!!! Google AI models will not function without a valid API key.            !!!");
  console.warn("!!! Please set GOOGLE_API_KEY in your .env file.                         !!!");
  console.warn("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
}


// --- Prompt Texts ---

const PROJECT_DECOMPOSITION_PROMPT_TEXT = `
Decompose the following project brief into concrete steps required to get it done. Return your response in markdown format.
Project Brief: {{{brief}}}`;

// --- Genkit Initialization ---

// Initialize Genkit with only GoogleAI plugin active
// Pass the API key from the environment variable
export const ai = genkit({
  promptDir: './prompts',
  plugins: [
    googleAI({ apiKey: GOOGLE_API_KEY }), // Use environment variable here
  ],
  model: 'googleai/gemini-2.0-flash', // Default model remains Gemini
});

// --- Prompt Definitions ---

// Define prompt for project brief decomposition (uses default model unless overridden)
const projectDecompositionPrompt = ai.definePrompt({
  name: 'projectDecompositionPrompt',
  input: { schema: z.object({ brief: z.string() }) },
  output: { schema: z.string().describe('Decomposed project steps in markdown format.') },
  prompt: PROJECT_DECOMPOSITION_PROMPT_TEXT,
  // Model will be the default 'googleai/gemini-2.0-flash' unless explicitly overridden in the flow call
});


// --- Exported Helper Functions ---

/**
 * Decomposes a project brief into smaller, manageable steps using the default AI model.
 * @param brief The full project brief.
 * @returns The decomposed steps as a markdown string, or a default message on error.
 */
export async function decomposeProjectBrief(brief: string): Promise<string> {
  const decompositionModel = 'googleai/gemini-2.0-flash'; // Use default model explicitly for clarity

  try {
    // Call the prompt definition directly using the selected model
    const { output } = await projectDecompositionPrompt({ brief }, { model: decompositionModel });
    if (output) {
        return output;
    }
    console.warn(`Decomposition returned empty output for model ${decompositionModel}.`);
  } catch (e: any) {
    console.error(`Error during decomposition with model ${decompositionModel}:`, e.message);
    // Add specific check for API key related errors
    if (e.message?.includes('API key') || e.message?.includes('authentication')) {
        console.error(`Ensure your GOOGLE_API_KEY in the .env file is valid and has permissions.`);
    }
  }
  return "Failed to decompose project brief."; // Default error message
}

/**
 * Checks if a user-specific fine-tuned model exists.
 * Placeholder function - fine-tuning is not implemented.
 * @param userId The ID of the freelancer.
 * @returns Always undefined as fine-tuning is not implemented.
 */
export async function getUserSpecificModel(userId: string): Promise<string | undefined> {
    console.log(`Checking for user-specific model for user ${userId}... (Fine-tuning not implemented)`);
    // --- TODO: Implement actual fine-tuning lookup logic ---
    // This would involve checking your database for a stored fine-tuned model ID.
    return undefined; // Always return undefined as fine-tuning is not implemented
}
