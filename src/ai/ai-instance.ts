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
// Moved from model-selector.ts into this file, requires 'use server'
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
  if (availableModels.includes('googleai/gemini-1.5-flash')) {
    console.log("[AI Model Selection] Defaulting to googleai/gemini-1.5-flash.");
    return 'googleai/gemini-1.5-flash'; // Good general-purpose default
  }
  // Other cost-effective fallbacks
  if (availableModels.includes('anthropic/claude-3-haiku-20240307')) { // Claude Haiku
     console.log("[AI Model Selection] Fallback to anthropic/claude-3-haiku-20240307.");
     return 'anthropic/claude-3-haiku-20240307';
  }
  if (availableModels.includes('openai/gpt-4o-mini')) { // GPT-4o Mini
    console.log("[AI Model Selection] Fallback to openai/gpt-4o-mini.");
    return 'openai/gpt-4o-mini';
  }

  // If somehow none of the specific fallbacks match, return the first available
  console.warn("[AI Model Selection] No specific model match or preferred fallback found, returning first available:", availableModels[0]);
  return availableModels[0];
}

// --- Cross-Validation Logic ---
// This function needs 'use server' as it calls ai.generate

const ValidationSchema = z.object({
  isValid: z.boolean().describe("Whether the original output is valid and accurate based on the original request."),
  reasoning: z.string().optional().describe("Explanation if invalid, or brief confirmation if valid."),
});
type ValidationResult = z.infer<typeof ValidationSchema>;

/**
 * Validates the output of one AI model using two other models.
 * @param originalPrompt - The initial prompt given to the first model.
 * @param originalOutput - The output generated by the first model.
 * @param primaryModelName - The name of the model that generated the originalOutput.
 * @returns A promise resolving to an object indicating if the output is valid and reasoning.
 */
export async function validateAIOutput(
  originalPrompt: string,
  originalOutput: string,
  primaryModelName: string
): Promise<{ allValid: boolean; results: ValidationResult[] }> {
  // Re-read env vars at runtime
  const GOOGLE_API_KEY_RUNTIME    = process.env.GOOGLE_API_KEY;
  const OPENAI_API_KEY_RUNTIME    = process.env.OPENAI_API_KEY;
  const ANTHROPIC_API_KEY_RUNTIME = process.env.ANTHROPIC_API_KEY;

  const validatorModels: string[] = [];
  // Select two different models for validation, if available
  if (primaryModelName !== 'googleai/gemini-1.5-flash' && GOOGLE_API_KEY_RUNTIME) {
      validatorModels.push('googleai/gemini-1.5-flash');
  }
  if (primaryModelName !== 'openai/gpt-4o-mini' && primaryModelName !== 'openai/gpt-4o' && OPENAI_API_KEY_RUNTIME) {
      // Use a cost-effective OpenAI model for validation
      validatorModels.push('openai/gpt-4o-mini');
  }
  if (primaryModelName !== 'anthropic/claude-3-5-sonnet-20240620' && primaryModelName !== 'anthropic/claude-3-haiku-20240307' && ANTHROPIC_API_KEY_RUNTIME) {
      // Use a cost-effective Anthropic model for validation
      validatorModels.push('anthropic/claude-3-haiku-20240307');
  }

  // Ensure we have at least two validators if possible
  if (validatorModels.length < 2) {
     console.warn("Not enough distinct models available for full cross-validation. Skipping or performing partial validation.");
     // If only one validator is available, add the primary model back (less ideal) or skip validation
     if (validatorModels.length === 0) {
         console.error("No validator models available!");
         return { allValid: true, results: [{isValid: true, reasoning: "Skipped validation: No validators."}] }; // Assume valid if no validators
     }
     // If one validator, maybe add the primary back? Or just use one? Using one for now.
     console.warn("Proceeding with only one validator model.");
  }

  const validationPrompt = ai.definePrompt({
      name: 'aiOutputValidationPrompt',
      input: { schema: z.object({ originalPrompt: z.string(), originalOutput: z.string() }) },
      output: { schema: ValidationSchema },
      prompt: `You are an AI validation assistant. Review the original AI output based on the original prompt.
      Determine if the output is valid, accurate, complete, and directly addresses the request.

      Original Prompt:
      {{{originalPrompt}}}

      Original Output:
      {{{originalOutput}}}

      Is the output valid and does it satisfy the prompt? Respond ONLY with a JSON object matching this structure:
      {
        "isValid": boolean (true or false),
        "reasoning": "string (required if invalid, or brief confirmation if valid, or short explanation if an error occurred)"
      }`,
  });

  const validationPromises = validatorModels.slice(0, 2).map(async (modelName) => { // Use max 2 validators
      console.log(`Validating output using ${modelName}...`);
      try {
          const { output } = await validationPrompt(
              { originalPrompt, originalOutput },
              { model: modelName }
          );
          return output || { isValid: false, reasoning: `Validation model ${modelName} failed to respond.` };
      } catch (err: any) {
          console.error(`Error during validation with ${modelName}:`, err.message);
          return { isValid: false, reasoning: `Error during validation with ${modelName}: ${err.message}` };
      }
  });

  const results = await Promise.all(validationPromises);
  const allValid = results.every(r => r.isValid);

  console.log(`Cross-validation complete. Overall validity: ${allValid}. Results:`, results);
  return { allValid, results };
}

// --- Removed callAI function ---
// The logic including cross-validation needs to be reimplemented at a higher level,
// possibly within specific flows or a dedicated validation utility if required.
// Individual flows will now directly use `ai.generate()` or defined prompts.

// --- Removed Prompt Definitions ---
// Prompt definitions (like validationPrompt) should live closer to where they are used,
// typically within the specific flow file or a shared prompts module.

// --- Removed Fine-tuning placeholders ---
// Fine-tuning logic (getUserFineTunedModel, triggerFineTuningJob) is complex
// and requires significant infrastructure beyond basic API calls.
// It would typically involve dedicated services and asynchronous job handling.
// It would typically involve dedicated services and asynchronous job handling.
