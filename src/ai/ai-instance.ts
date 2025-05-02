'use server'; // Ensure this is at the top for server actions like validateAIOutput

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { openAI } from 'genkitx-openai';
import { anthropic } from 'genkitx-anthropic';
import { z } from 'zod'; // Use standard Zod import

// --- Environment Variables (Read at runtime in chooseModelBasedOnPrompt and validateAIOutput) ---
// These are accessed dynamically within the functions that need them.

// --- AI Plugin Configuration ---
// Plugins are initialized when the module loads.
const plugins = [];

// Add plugins conditionally based on key presence *at initialization*
// This determines if the plugin is even available to Genkit.
const GOOGLE_API_KEY_INIT = process.env.GOOGLE_API_KEY;
const OPENAI_API_KEY_INIT = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY_INIT = process.env.ANTHROPIC_API_KEY;

if (GOOGLE_API_KEY_INIT) {
  console.log("[AI Config] Google AI Plugin Added.");
  plugins.push(googleAI());
} else {
  console.warn("[AI Config] Google API Key missing, Google AI Plugin skipped.");
}

if (OPENAI_API_KEY_INIT) {
  console.log("[AI Config] OpenAI Plugin Added.");
  plugins.push(openAI());
} else {
  console.warn("[AI Config] OpenAI API Key missing, OpenAI Plugin skipped.");
}

if (ANTHROPIC_API_KEY_INIT) {
  console.log("[AI Config] Anthropic Plugin Added.");
  plugins.push(anthropic());
} else {
  console.warn("[AI Config] Anthropic API Key missing, Anthropic Plugin skipped.");
}

// --- AI Instance Configuration ---
export const ai = genkit({
  plugins,
  // logLevel: 'debug', // Uncomment for detailed Genkit logs
});


// --- Model Selection Logic ---
/**
 * Chooses an AI model based on the prompt's content and API key availability.
 * This function reads environment variables at runtime.
 */
export async function chooseModelBasedOnPrompt(promptContent: string): Promise<string> {
  // Re-evaluate API keys at runtime inside the function
  const GOOGLE_API_KEY    = process.env.GOOGLE_API_KEY;
  const OPENAI_API_KEY    = process.env.OPENAI_API_KEY;
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  const promptLength = promptContent.length;
  const promptLower = promptContent.toLowerCase();
  const availableModels: string[] = [];
  const allModels = {
    google: 'googleai/gemini-1.5-flash', // Cost-effective baseline
    openai: ['openai/gpt-4o-mini', 'openai/gpt-4o'], // o3 mini high equivalent is likely gpt-4o-mini, keeping gpt-4o as option
    anthropic: ['anthropic/claude-3-haiku-20240307', 'anthropic/claude-3-5-sonnet-20240620'] // Haiku is cost-effective, Sonnet 3.5 is advanced
  };

  // Populate availableModels based on which keys are present *at call time*
  if (GOOGLE_API_KEY)    availableModels.push(allModels.google);
  if (OPENAI_API_KEY)    availableModels.push(...allModels.openai);
  if (ANTHROPIC_API_KEY) availableModels.push(...allModels.anthropic);

  if (availableModels.length === 0) {
    console.error('[AI Model Selection] No models available due to missing API keys.');
    // Fallback or error based on requirements. Returning a default to avoid crashing.
    // Consider throwing an error if AI is critical: throw new Error('No AI models available.');
    return allModels.google; // Default fallback if possible
  }

  // Specific routing for coding/development to OpenAI o3 mini (gpt-4o-mini)
  if ( (promptLower.includes('code') || promptLower.includes('```') || promptLower.includes('debug') || promptLower.includes('development') || promptLower.includes('software') || promptLower.includes('scripting')) && availableModels.includes('openai/gpt-4o-mini') ) {
     console.log("[AI Model Selection] Choosing openai/gpt-4o-mini for coding/dev task.");
     return 'openai/gpt-4o-mini';
  }

  // Prioritize specific models based on keywords if available
  if ( (promptLower.includes('graphic design') || promptLower.includes('visual critique')) && availableModels.includes('openai/gpt-4o') ) { // Use full gpt-4o for visual tasks
    console.log("[AI Model Selection] Choosing openai/gpt-4o for graphic design.");
    return 'openai/gpt-4o';
  }
  if ( (promptLength > 1500 || promptLower.includes('analysis') || promptLower.includes('report')) && availableModels.includes('anthropic/claude-3-5-sonnet-20240620') ) {
    console.log("[AI Model Selection] Choosing anthropic/claude-3-5-sonnet-20240620 for long/analysis task.");
    return 'anthropic/claude-3-5-sonnet-20240620';
  }
  if ( (promptLower.includes('creative') || promptLower.includes('story') || promptLower.includes('marketing')) && availableModels.includes('anthropic/claude-3-5-sonnet-20240620') ) {
      console.log("[AI Model Selection] Choosing anthropic/claude-3-5-sonnet-20240620 for creative task.");
      return 'anthropic/claude-3-5-sonnet-20240620';
  }

  // Fallback logic - Prioritize Google AI Flash if available and no other specific match
  if (availableModels.includes(allModels.google)) {
    console.log("[AI Model Selection] Defaulting to googleai/gemini-1.5-flash.");
    return allModels.google; // Good general-purpose default
  }
  // Other cost-effective fallbacks
  if (availableModels.includes(allModels.anthropic[0])) { // Claude Haiku
     console.log("[AI Model Selection] Fallback to anthropic/claude-3-haiku-20240307.");
     return allModels.anthropic[0];
  }
  if (availableModels.includes(allModels.openai[0])) { // GPT-4o Mini
    console.log("[AI Model Selection] Fallback to openai/gpt-4o-mini.");
    return allModels.openai[0];
  }

  // If somehow none of the specific fallbacks match, return the first available
  console.warn("[AI Model Selection] No specific model match or preferred fallback found, returning first available:", availableModels[0]);
  return availableModels[0];
}

// --- Cross-Validation Logic ---
// This function needs 'use server' as it calls ai.generate
// It is defined here but should be imported and used within other server actions/flows.

const ValidationSchema = z.object({
  isValid: z.boolean().describe("Whether the original output is valid and accurate based on the original request."),
  reasoning: z.string().optional().describe("Explanation if invalid, or brief confirmation if valid."),
});
type ValidationResult = z.infer<typeof ValidationSchema>;

/**
 * Performs cross-validation of an AI model's output using other available models.
 * This function is a server action and must be called from a server context.
 */
export async function validateAIOutput(
  originalPrompt: string,
  originalOutput: string,
  primaryModelName: string
): Promise<{ allValid: boolean; results: ValidationResult[] }> {
  const validatorModels: string[] = [];
  const availableModels = {
    google: 'googleai/gemini-1.5-flash',
    openai: ['openai/gpt-4o-mini', 'openai/gpt-4o'],
    anthropic: ['anthropic/claude-3-haiku-20240307', 'anthropic/claude-3-5-sonnet-20240620']
  };

  // Re-read env vars inside this function to ensure up-to-date checks
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  if (GOOGLE_API_KEY && primaryModelName !== availableModels.google) validatorModels.push(availableModels.google);
  // Prefer cheaper models for validation if available
  if (OPENAI_API_KEY && !primaryModelName.startsWith('openai/')) validatorModels.push(availableModels.openai[0]);
  if (ANTHROPIC_API_KEY && !primaryModelName.startsWith('anthropic/')) validatorModels.push(availableModels.anthropic[0]);

  if (validatorModels.length === 0) {
    console.warn("[AI Validation] No other models available for cross-validation. Skipping.");
    return { allValid: true, results: [] }; // Assume valid if no validators
  }

  console.log(`[AI Validation] Validating output from ${primaryModelName} using models: ${validatorModels.join(', ')}`);

  const validationPrompt = `You are an AI evaluator. Assess if the following AI output accurately and completely fulfills the original request.
Return ONLY a JSON object with keys "isValid" (boolean) and "reasoning" (string, explanation if invalid, brief confirmation if valid).

=== Original Request ===
${originalPrompt}

=== AI Output to Validate ===
${originalOutput}

=== Evaluation ===
Does the output strictly follow the requested format (if any) and address all parts of the original request accurately?
Is the output sensible and relevant to the request?
Respond ONLY with the JSON object: {"isValid": boolean, "reasoning": string}`;

  const validationResults: ValidationResult[] = [];
  let allValid = true;

  for (const modelName of validatorModels) {
    try {
      // Define the model dynamically within the loop for validation
      const validationAI = ai.defineModel({
          name: `validationModel_${modelName.replace(/[^a-zA-Z0-9]/g, '_')}`, // Unique name for dynamic model definition
          model: modelName, // Specify the model string directly
          output: { schema: ValidationSchema }, // Request JSON output
      });

      // Generate the validation result using the dynamically defined model
      const { output } = await validationAI.generate({
        prompt: validationPrompt,
        output: { schema: ValidationSchema } // Ensure output schema is requested
      });

      if (output) {
         // Attempt to parse the output against the schema
         const parsedOutput = ValidationSchema.parse(output);
         validationResults.push(parsedOutput);
         if (!parsedOutput.isValid) {
           allValid = false;
         }
         console.log(`[AI Validation] Validator ${modelName} result: isValid=${parsedOutput.isValid}`);
      } else {
        // Handle cases where the validator model returns null/undefined
        console.warn(`[AI Validation] Validator ${modelName} returned empty output.`);
        validationResults.push({ isValid: false, reasoning: `Validator ${modelName} failed to provide valid output.` });
        allValid = false;
      }
    } catch (error: any) {
        // Handle Zod parsing errors or other generation errors
        console.error(`[AI Validation] Error validating with ${modelName}:`, error.message);
        validationResults.push({ isValid: false, reasoning: `Error during validation with ${modelName}: ${error.message}` });
        allValid = false;
    }
  }

  console.log(`[AI Validation] Final validation result: allValid=${allValid}`);
  return { allValid, results: validationResults };
}

/*
// --- EXAMPLE: How to include validateAIOutput in a flow file ---
// File: src/ai/flows/generate-project-idea.ts
'use server';

import { ai } from '@/lib/ai'; // Use instance from lib
import { chooseModelBasedOnPrompt, validateAIOutput } from '@/ai/ai-instance'; // Import helpers
import { z } from 'zod';
// ... other imports

// ... (rest of the flow definition) ...

const generateProjectIdeaFlow = ai.defineFlow<...>(async (input) => {
   ...
   const primaryModel = await chooseModelBasedOnPrompt(...);
   const { output: rawOutput } = await somePrompt(...);
   const rawResponse = JSON.stringify(rawOutput); // Example: if output is JSON

   // Perform validation
   const validation = await validateAIOutput(originalPromptText, rawResponse, primaryModel);
   if (!validation.allValid) {
      // Handle validation failure (throw error, use fallback, retry, etc.)
      console.error("Validation failed:", validation.results);
      throw new Error("AI output failed cross-validation.");
   }
   // Proceed with validated output
   ...
});

export async function generateProjectIdea(...) { ... }
*/


// --- Removed Fine-tuning placeholders ---
// Fine-tuning logic is complex and removed for clarity.
