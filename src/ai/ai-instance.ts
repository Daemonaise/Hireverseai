'use server';
/**
 * @fileOverview Handles AI model selection and calls, currently configured for Gemini.
 */

import { z } from 'zod';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import fetch from 'node-fetch'; // Required for OpenAI/Anthropic fetch calls if not using Genkit plugins

// --- Environment Variables ---
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
// Keep these even if not using plugins yet, for the direct fetch calls
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Basic validation/warning
if (!GOOGLE_API_KEY) console.warn("Missing GOOGLE_API_KEY. AI features may be limited.");
if (!OPENAI_API_KEY) console.warn("Missing OPENAI_API_KEY. OpenAI calls will fail.");
if (!ANTHROPIC_API_KEY) console.warn("Missing ANTHROPIC_API_KEY. Anthropic calls will fail.");


// --- Genkit Initialization ---
const ai = genkit({
  promptDir: './prompts',
  plugins: [googleAI({ apiKey: GOOGLE_API_KEY })],
  model: 'googleai/gemini-1.5-flash-latest', // Default model
});


// --- Decomposition Prompt (Google Gemini) ---
// This is a separate, static prompt definition, NOT used by the generic callAI
const PROJECT_DECOMPOSITION_PROMPT_TEXT = `
Decompose the following project brief into concrete steps required to get it done. Return your response in markdown format.
Project Brief: {{{brief}}}
`;

const projectDecompositionPrompt = ai.definePrompt({
  name: 'projectDecompositionPrompt',
  input: { schema: z.object({ brief: z.string() }) },
  output: { schema: z.string().describe('Decomposed project steps in markdown format.') },
  prompt: PROJECT_DECOMPOSITION_PROMPT_TEXT,
  config: { model: 'googleai/gemini-1.5-flash-latest' }
});

// --- Exported Async Functions (Server Actions) ---

// This function remains exported as it's intended to be called from client components or other server actions
export async function decomposeProjectBrief(brief: string): Promise<string> {
  try {
    const { output } = await projectDecompositionPrompt({ brief });
    return output ?? "Failed to decompose project brief.";
  } catch (e: any) {
    console.error(`Error during decomposition:`, e.message ?? e);
    return "Failed to decompose project brief.";
  }
}

// This function is intended for generic AI calls, routing to the appropriate model
// It now uses ai.generate for Gemini and direct fetch for others until plugins are properly configured.
export async function callAI(model: 'gemini' | 'gpt-4o' | 'claude-3', prompt: string): Promise<string> {
  try {
    if (model === 'gemini') {
      if (!GOOGLE_API_KEY) throw new Error('Google API Key is not configured.');
      console.log(`Calling Genkit Gemini for prompt: "${prompt.substring(0,50)}..."`);

      // Use Genkit's ai.generate for dynamic prompts with the default Gemini model
      const response = await ai.generate({
        prompt: prompt,
        model: 'googleai/gemini-1.5-flash-latest', // Explicitly use the configured model
        config: { temperature: 0.7 } // Optional config
      });
      return response.text() ?? "Failed to generate with Gemini.";
    }

    // --- Direct Fetch Calls (Keep as fallback until plugins are fully working) ---
    if (model === 'gpt-4o') {
        if (!OPENAI_API_KEY) throw new Error('OpenAI API Key is not configured.');
        console.log(`Calling OpenAI API directly for prompt: "${prompt.substring(0,50)}..."`);
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
           const errorBody = await response.text();
           throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
         }
        const data = await response.json() as any;
        return data.choices?.[0]?.message?.content ?? "Failed to generate with GPT-4o.";
    }

    if (model === 'claude-3') {
        if (!ANTHROPIC_API_KEY) throw new Error('Anthropic API Key is not configured.');
        console.log(`Calling Anthropic API directly for prompt: "${prompt.substring(0,50)}..."`);
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-3-opus-20240229', // Or another suitable Claude model
            max_tokens: 1024, // Ensure max_tokens is reasonable
            messages: [{ role: 'user', content: prompt }],
          }),
        });
        if (!response.ok) {
           const errorBody = await response.text();
           throw new Error(`Anthropic API error (${response.status}): ${errorBody}`);
         }
        const data = await response.json() as any;
        // Claude returns content differently
        const textContent = data.content?.find((block: any) => block.type === 'text')?.text;
        return textContent ?? "Failed to generate with Claude-3.";
    }

    console.error(`Invalid model selection in callAI: ${model}`);
    return "Invalid model selection.";

  } catch (error: any) {
    console.error(`Error calling AI model (${model}):`, error.message ?? error);
    if (error.message?.includes('API Key')) {
      return `Error: API Key missing or invalid for ${model}.`;
    }
    // Check for schema validation errors specifically from Gemini
     if (error.message?.includes('Schema validation failed') || error.message?.includes('INVALID_ARGUMENT')) {
        return `Error: AI failed schema validation. ${error.message}`;
     }
    return `Error during AI generation with ${model}. ${error.message}`;
  }
}

// No longer exporting chooseModelBasedOnPrompt as it's internal logic for flows
// or handled by a different mechanism.
// If flows need model selection, they should implement it internally.
