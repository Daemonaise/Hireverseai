

/**
 * @fileOverview Defines the Genkit AI instance, external AI calls, and project decomposition.
 */

import { genkit } from 'genkit'; // Removed defineSchema import
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'genkit'; // Use genkit's Zod export
import fetch from 'node-fetch'; // Ensure fetch is available server-side

// --- Environment Variables ---
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // Keep for future use or other direct calls
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY; // Keep for future use or other direct calls

if (!GOOGLE_API_KEY) {
  console.warn("Missing GOOGLE_API_KEY in environment variables. AI calls might fail.");
}
if (!OPENAI_API_KEY) {
    console.warn("Missing OPENAI_API_KEY in environment variables. GPT-4o calls will fail.");
}
if (!ANTHROPIC_API_KEY) {
    console.warn("Missing ANTHROPIC_API_KEY in environment variables. Claude-3 calls will fail.");
}


// --- Genkit (Google AI) Initialization ---
export const ai = genkit({
  plugins: [
     googleAI({ apiKey: GOOGLE_API_KEY }),
     // Add other plugins here if/when available and installed, e.g.:
     // openAI({ apiKey: OPENAI_API_KEY }),
     // anthropic({ apiKey: ANTHROPIC_API_KEY }),
  ],
  // Default model can be specified here or in each prompt/flow
  model: 'googleai/gemini-1.5-flash-latest', // Using latest flash model
  logLevel: 'debug',
  enableTracing: true,
});


// --- Project Decomposition Prompt (Example using Gemini via Genkit) ---
// This is an example and might be replaced by decompose-project.ts flow
// Define Zod schemas directly without defineSchema
const projectBriefSchema = z.object({ brief: z.string() });

const projectDecompositionOutputSchema = z.string().describe('Decomposed project steps in markdown format.');


const projectDecompositionPrompt = ai.definePrompt({
  name: 'projectDecompositionPrompt',
  model: 'googleai/gemini-1.5-flash-latest', // Specify model
  // Pass Zod schemas directly
  input: { schema: projectBriefSchema },
  output: { schema: projectDecompositionOutputSchema },
  prompt: `
Decompose the following project brief into concrete steps required to get it done. Return your response in markdown format.
Project Brief: {{{brief}}}
`,
});

// --- Main Functions ---

/**
 * Decomposes a project brief using the default Genkit configured model (Gemini).
 * @param brief - The project brief string.
 * @returns Decomposed steps or an error message.
 * @deprecated Use decomposeProject flow in src/ai/flows/decompose-project.ts instead.
 */
export async function decomposeProjectBrief(brief: string): Promise<string> {
  console.warn("decomposeProjectBrief is deprecated. Use the decomposeProject flow instead.");
  try {
    const { output } = await projectDecompositionPrompt({ brief });
    return output ?? "Failed to decompose project brief.";
  } catch (e: any) {
    console.error(`Error during decomposition: ${e.message}`);
    // Provide more context on the error if possible
    if (e.message?.includes('API key')) {
         return "Failed to decompose project brief due to an API key issue with the configured AI provider.";
    }
     if (e.message?.includes('INVALID_ARGUMENT')) {
         return "Failed to decompose project brief. There might be an issue with the input format or prompt configuration.";
    }
    return `Failed to decompose project brief. Error: ${e.message}`;
  }
}

/**
 * Placeholder function to get a user-specific model ID.
 * Fine-tuning logic would go here.
 * @param userId - The ID of the user (e.g., freelancer).
 * @returns A model identifier string or undefined.
 */
export async function getUserSpecificModel(userId: string): Promise<string | undefined> {
  console.log(`Checking for user-specific model for user ${userId}...`);
  // TODO: Implement logic to fetch user-specific fine-tuned model ID from Firestore/DB
  // Example check:
  // if (userId === 'test-freelancer-finetune') return 'your-fine-tuned-model-id';
  return undefined; // Always return undefined as fine-tuning is not implemented
}


/**
 * Calls a specified AI model with a given prompt.
 * Currently only supports Gemini via Genkit. Direct calls to OpenAI/Anthropic are kept for reference.
 * @param model - The model to call ('gemini', 'gpt-4o', 'claude-3').
 * @param prompt - The text prompt for the AI.
 * @returns The AI's response as a string or an error message.
 */
export async function callAI(model: 'gemini' | 'gpt-4o' | 'claude-3', prompt: string): Promise<string> {
  try {
    if (model === 'gemini') {
      // Using a generic prompt structure for demonstration.
      // You might want more specific prompts for different use cases.
      console.log("Calling Gemini via Genkit generic text prompt...");
      const genericPrompt = ai.definePrompt({
          name: 'genericGeminiPrompt',
          model: 'googleai/gemini-1.5-flash-latest', // Ensure model is specified
          input: { schema: z.string() },
          output: { schema: z.string() },
          prompt: `{{{input}}}`, // Simple passthrough prompt
      });

      const { output } = await genericPrompt(prompt);
      return output ?? `Failed to generate response with Gemini for prompt: ${prompt.substring(0, 50)}...`;
    }

    // --- Direct API calls (kept for reference, ensure keys are set) ---
    if (model === 'gpt-4o') {
      if (!OPENAI_API_KEY) return "Error: OpenAI API Key not configured.";
      console.log("Calling OpenAI GPT-4o directly...");
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
           const errorData = await response.json();
           console.error("OpenAI API Error:", errorData);
           throw new Error(`OpenAI API request failed with status ${response.status}: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json() as any;
      return data.choices?.[0]?.message?.content ?? "Failed to generate with GPT-4o.";
    }

    if (model === 'claude-3') {
      if (!ANTHROPIC_API_KEY) return "Error: Anthropic API Key not configured.";
      console.log("Calling Anthropic Claude-3 directly...");
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-opus-20240229', // Or another Claude model
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

        if (!response.ok) {
           const errorData = await response.json();
           console.error("Anthropic API Error:", errorData);
           throw new Error(`Anthropic API request failed with status ${response.status}: ${errorData.error?.message || response.statusText}`);
        }

      const data = await response.json() as any;
      return data.content?.[0]?.text ?? "Failed to generate with Claude-3.";
    }

    return "Invalid model selection.";
  } catch (error: any) {
    console.error(`Error calling AI model '${model}':`, error);
    // Provide more specific error message if possible
    return `Error during AI generation (${model}): ${error.message}`;
  }
}


// --- Direct External API Call Functions (Keep for reference or potential direct use) ---
// Note: These are effectively duplicates of the logic within callAI now.

/**
 * Directly calls OpenAI GPT-4o API.
 * @param prompt - The prompt string.
 * @returns The response content or 'No response.'.
 * @deprecated Prefer using callAI function or Genkit plugins when available.
 */
export async function callOpenAIGpt4o(prompt: string): Promise<string> {
   console.warn("Direct callOpenAIGpt4o is deprecated. Use callAI('gpt-4o', prompt).");
   return callAI('gpt-4o', prompt);
}

/**
 * Directly calls Anthropic Claude-3 API.
 * @param prompt - The prompt string.
 * @returns The response content or 'No response.'.
 * @deprecated Prefer using callAI function or Genkit plugins when available.
 */
export async function callAnthropic(prompt: string): Promise<string> {
  console.warn("Direct callAnthropic is deprecated. Use callAI('claude-3', prompt).");
  return callAI('claude-3', prompt);
}
