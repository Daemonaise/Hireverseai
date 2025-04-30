'use server';

import { genkit } from 'genkit';
import { anthropic, claude35Sonnet } from 'genkitx-anthropic';
import { openAI, gpt4o }      from 'genkitx-openai';
import { googleAI, gemini15Flash } from '@genkit-ai/googleai'; // Corrected import path
import { z } from 'zod';
import fetch from 'node-fetch'; // Ensure fetch is available server-side
import { chooseModelBasedOnPrompt } from '@/lib/model-selector'; // Import the selector


// --- Environment Variables ---
// Ensure these are set in your .env file or environment
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY!; // Use GOOGLE_API_KEY for Gemini

// --- Input Validation ---
// Add basic checks to warn if keys are missing, essential for debugging
if (!GOOGLE_API_KEY) console.warn('Missing GOOGLE_API_KEY. Gemini calls will fail.');
// if (!OPENAI_API_KEY) console.warn('Missing OPENAI_API_KEY. OpenAI calls will fail.');
// if (!ANTHROPIC_API_KEY) console.warn('Missing ANTHROPIC_API_KEY. Anthropic calls will fail.');


// --- Genkit Initialization ---
// Configure Genkit with the Google AI plugin.
// Other plugins are commented out as requested.
// Remove 'export' keyword to prevent "use server" error
const ai = genkit({
  version: '1.5.0', // Use a consistent Genkit version
  promptDir: './prompts',
  defaultModel: 'googleai/gemini-1.5-flash', // Use the Gemini model as default
  logLevel: 'debug',
  plugins: [
    googleAI({ apiKey: GOOGLE_API_KEY }),
    // openAI({ apiKey: OPENAI_API_KEY }), // Keep commented out
    // anthropic({ apiKey: ANTHROPIC_API_KEY }), // Keep commented out
  ],
});


// --- Static Prompt Definition (Example) ---
// Define a static prompt for a specific task, e.g., project decomposition
const projectDecompositionPrompt = ai.definePrompt({
    name: 'projectDecomposition',
    input: { schema: z.object({ brief: z.string() }) },
    output: { schema: z.string() },
    model: 'googleai/gemini-1.5-flash', // Specify the model (optional, uses default if not set)
    prompt: `
Decompose the following project brief into concrete steps in markdown:
{{brief}}
`,
});

// --- Exported Function using the Static Prompt ---
// This function wraps the call to the static prompt
export async function decomposeProjectBrief(brief: string): Promise<string> {
  'use server'; // Ensure this runs server-side if called directly from client components
  try {
    const { output } = await projectDecompositionPrompt({ brief });
    return output ?? 'No decomposition output.';
  } catch (e: any) {
    console.error("Error during decomposition:", e.message);
    // Add more specific error handling based on potential API errors
    if (e.message.includes('API Key') || e.message.includes('PERMISSION_DENIED')) {
       return "Failed due to API key or permission issue.";
    }
    if (e.message.includes('NOT_FOUND')) {
      return "Specified AI model not found.";
    }
     if (e.message.includes('validation')) {
        return `Schema validation failed: ${e.message}`;
     }
    return `Decomposition failed: ${e.message}`;
  }
}

// --- Generalized AI Call Function (Centralized Logic) ---
// This function handles calling the configured AI model dynamically.
// It's useful when the prompt isn't static or requires model selection.
export async function callAI(
  modelType: 'auto' | 'gemini', // Allow 'auto' or specific model type
  prompt: string,
): Promise<string> {
  'use server'; // Ensure this runs server-side if called directly from client components
  try {
    let selectedModel: string;

    if (modelType === 'auto') {
      // Since only Gemini is active, always use it
      selectedModel = 'googleai/gemini-1.5-flash'; // Directly use Gemini
      // selectedModel = chooseModelBasedOnPrompt(prompt); // Commented out model selection
    } else if (modelType === 'gemini') {
      // Default to Gemini Flash if 'gemini' is specified
      selectedModel = 'googleai/gemini-1.5-flash'; // Directly use Gemini
    } else {
      throw new Error(`Unsupported model type specified: ${modelType}`);
    }

    console.log(`Calling AI with model: ${selectedModel}`);

    // Use Genkit's generate method
    const response = await ai.generate({
      model: selectedModel, // Use the determined model name string
      prompt,
      config: { temperature: 0.7 }, // Example config
    });

    const text = response.text();
    if (!text) {
      throw new Error('No output text received from the AI model.');
    }
    return text;

  } catch (e: any) {
    console.error(`Error in callAI (${modelType}):`, e.message);
    // Improved error messages
    if (e.message.includes('API Key') || e.message.includes('PERMISSION_DENIED')) {
      return `API key missing, invalid, or lacks permissions for the selected model.`;
    }
    if (e.message.includes('NOT_FOUND')) {
      return `The selected AI model was not found or is unavailable.`;
    }
    if (e.message.includes('validation')) {
       return `Schema validation failed during AI call: ${e.message}`;
    }
    // Provide a more generic fallback
    return `AI generation error: ${e.message || 'An unknown error occurred.'}`;
  }
}


// Note: getUserFineTunedModel function was removed as it's not implemented.
