

/**
 * ai-instance.ts
 * Initializes Genkit with configured plugins (currently only Google Gemini)
 * and provides core AI interaction functions.
 */

import { genkit } from 'genkit';
import { googleAI, gemini15Flash } from '@genkit-ai/googleai';
import { openAI, gpt4o }          from 'genkitx-openai';
import { anthropic, claude35Sonnet } from 'genkitx-anthropic';
import { z } from 'zod';
import fetch from 'node-fetch'; // Ensure fetch is available server-side
import { chooseModelBasedOnPrompt } from '@/lib/model-selector'; // Import the selector

// --- Environment Variables ---
const OPENAI_API_KEY    = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GOOGLE_API_KEY    = process.env.GOOGLE_API_KEY;

// --- Log API Key Status (Optional but helpful for debugging) ---
if (!GOOGLE_API_KEY) console.warn('[AI] GOOGLE_API_KEY is missing. Gemini models will not function.');
if (!OPENAI_API_KEY) console.warn('[AI] OPENAI_API_KEY is missing. OpenAI models will not function.');
if (!ANTHROPIC_API_KEY) console.warn('[AI] ANTHROPIC_API_KEY is missing. Anthropic models will not function.');


// --- Genkit Initialization ---
// Configure plugins only if their API keys are present
const genkitPlugins = [];
if (GOOGLE_API_KEY) {
  genkitPlugins.push(googleAI({ apiKey: GOOGLE_API_KEY }));
}
if (OPENAI_API_KEY) {
    genkitPlugins.push(openAI({ apiKey: OPENAI_API_KEY }));
}
if (ANTHROPIC_API_KEY) {
   genkitPlugins.push(anthropic({ apiKey: ANTHROPIC_API_KEY }));
}

if (genkitPlugins.length === 0) {
    console.error("[AI] No AI provider API keys found. AI features will be unavailable.");
    // Optionally, throw an error if AI is critical:
    // throw new Error("AI Provider configuration failed: No API keys found.");
}


export const ai = genkit({
  promptDir: './prompts', // Check if this directory exists/is needed
  // Set a default model if Google AI is configured, otherwise leave it undefined or handle dynamically
  logLevel: 'info', // Adjust log level as needed (e.g., 'debug' for more details)
  plugins: genkitPlugins,
});


// --- Centralized AI Call Function ---
/**
 * Calls the appropriate AI model based on the prompt content or explicit selection.
 *
 * @param modelSelection 'auto' to choose dynamically, or a specific model name (e.g., 'googleai/gemini-1.5-flash').
 * @param prompt The user's prompt content.
 * @param inputSchema Zod schema for the expected input (used for Gemini).
 * @param outputSchema Zod schema for the expected output (used for Gemini).
 * @returns The generated text response from the selected AI model.
 */
export async function callAI(
    modelSelection: 'auto' | string,
    prompt: string,
    inputSchema: z.ZodType = z.object({ prompt: z.string() }), // Default schema
    outputSchema: z.ZodType = z.string() // Default schema expects string output
): Promise<any> { // Return type 'any' for now, refine based on usage
  let targetModelName: string | undefined;

  if (modelSelection === 'auto') {
    targetModelName = chooseModelBasedOnPrompt(prompt);
  } else {
    targetModelName = modelSelection;
  }

  if (!targetModelName) {
    console.error("AI Call Error: No valid model could be determined or configured.");
    // Returning a structured error or default object might be better than throwing
    // Depending on how callers handle errors.
    return { status: 'error', reasoning: "AI configuration error: No model available." }; // Error 2 & 3 Fix
    // throw new Error("AI Call Error: No valid model could be determined or configured.");
  }

  console.log(`[AI] Calling model: ${targetModelName} for prompt: "${prompt.substring(0, 50)}..."`);

  try {
    // --- Gemini Call (using Genkit Prompt) ---
    if (targetModelName.startsWith('googleai/')) {
      if (!GOOGLE_API_KEY) throw new Error("Google AI API key is missing.");

      // Define a dynamic prompt for Gemini
      const dynamicGeminiPrompt = ai.definePrompt({
         name: `dynamicGemini_${Date.now()}`, // Ensure unique name if needed rapidly
         input: { schema: inputSchema },
         output: { schema: outputSchema },
         model: targetModelName,
         prompt: `{{{prompt}}}`, // Simple pass-through, assumes prompt contains all instructions
      });

       // Pass the raw prompt string within the input object matching the inputSchema
       const { output } = await dynamicGeminiPrompt({ prompt: prompt });
       return output; // Return the structured output validated by outputSchema
    }

    // --- OpenAI Call (using fetch API) ---
    if (targetModelName.startsWith('openai/')) {
      if (!OPENAI_API_KEY) throw new Error("OpenAI API key is missing.");
      const modelId = targetModelName.split('/')[1]; // e.g., 'gpt-4o'

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: prompt }],
          // Add other OpenAI parameters if needed (temperature, max_tokens, response_format for JSON)
          // response_format: { type: "json_object" }, // If expecting JSON
          temperature: 0.7,
        }),
      });
       if (!response.ok) {
           const errorData = await response.json();
           throw new Error(`OpenAI API Error (${response.status}): ${errorData?.error?.message || 'Unknown error'}`);
       }
      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content;

       // Attempt to parse if JSON is expected, otherwise return text
       try {
           // If outputSchema expects an object, assume JSON response
           if (outputSchema instanceof z.ZodObject) {
                return JSON.parse(content);
           }
       } catch (parseError) {
           console.error("[AI] OpenAI response was not valid JSON:", content);
           throw new Error("OpenAI response format error: Expected JSON.");
       }
      return content ?? "No response from OpenAI.";
    }

    // --- Anthropic Call (using fetch API) ---
    if (targetModelName.startsWith('anthropic/')) {
      if (!ANTHROPIC_API_KEY) throw new Error("Anthropic API key is missing.");
      const modelId = targetModelName.split('/')[1]; // e.g., 'claude-3-5-sonnet-20240620'

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          max_tokens: 1000, // Adjust as needed
          messages: [{ role: 'user', content: prompt }],
           // Add other Anthropic params if needed (temperature, system prompt)
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Anthropic API Error (${response.status}): ${errorData?.error?.message || 'Unknown error'}`);
      }
      const data = await response.json() as any;
      const content = data.content?.[0]?.text;

      // Attempt to parse if JSON is expected
      try {
         if (outputSchema instanceof z.ZodObject) {
             // Anthropic might return JSON within the text block, need robust parsing
             const jsonMatch = content.match(/\{[\s\S]*\}/); // Simple JSON block regex
             if (jsonMatch) {
                 return JSON.parse(jsonMatch[0]);
             } else {
                 throw new Error("Anthropic response did not contain expected JSON structure.");
             }
         }
      } catch (parseError) {
        console.error("[AI] Anthropic response was not valid JSON:", content);
        throw new Error("Anthropic response format error: Expected JSON.");
      }
      return content ?? "No response from Anthropic.";
    }

    // --- Fallback/Error ---
    throw new Error(`Unsupported or unknown model specified: ${targetModelName}`);

  } catch (error: any) {
    console.error(`[AI] Error calling model ${targetModelName}:`, error.message);
    // Return a consistent error structure or default based on outputSchema
     if (outputSchema instanceof z.ZodObject) {
         // Try to return a default object matching the schema structure, or a generic error object
         // This requires knowing the schema structure or having a default error object schema
         return { status: 'error', reasoning: `AI generation failed: ${error.message}` };
     }
    return `AI generation failed: ${error.message}`; // Default error string
  }
}


// --- Static Prompt Definition (Example for Decomposition) ---
// This demonstrates how to define a specific, reusable prompt using Genkit
// You might use this if a particular task ALWAYS uses a specific model and prompt structure.
// It's kept separate from the dynamic callAI function.

const ProjectDecompositionInputSchema = z.object({ brief: z.string() });
const ProjectDecompositionOutputSchema = z.string().describe('Markdown steps');

export const projectDecompositionPrompt = GOOGLE_API_KEY ? ai.definePrompt({
  name: 'projectDecomposition',
  model: gemini15Flash, // Specific model for this task
  input: { schema: ProjectDecompositionInputSchema },
  output: { schema: ProjectDecompositionOutputSchema },
  prompt: `
Decompose the following project brief into concrete, ordered steps (markdown):

{{brief}}
`,
}) : null; // Only define if Google AI is configured

/**
 * Breaks a free-form brief into a markdown checklist of tasks using a predefined prompt.
 * Example of using a specific Genkit prompt rather than the dynamic callAI.
 */
export async function decomposeProjectBrief(brief: string): Promise<string> {
  if (!projectDecompositionPrompt) {
      return '🚨 AI configuration error: Google AI not available for project decomposition.';
  }
  try {
    const { output } = await projectDecompositionPrompt({ brief });
    return output ?? '⚠️ No decomposition returned.';
  } catch (err: any) {
    console.error('[AI] Decomposition error:', err);
    // Simplified error reporting for brevity
    return `⚠️ Decomposition failed: ${err.message}`;
  }
}

// Note: Fine-tuning logic (getUserFineTunedModel, triggerFineTuningJob) is removed
// as it's complex and requires significant infrastructure beyond basic API calls.
// It would typically involve dedicated services and asynchronous job handling.
