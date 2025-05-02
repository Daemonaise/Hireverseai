'use server'; // Keep 'use server' only if *all* exports are async functions

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { openAI } from 'genkitx-openai';
import { anthropic } from 'genkitx-anthropic';
import { z } from 'zod';

// --- Environment Variables ---
// These are read when the server process starts. Ensure they are set in your environment.
const GOOGLE_API_KEY    = process.env.GOOGLE_API_KEY;
const OPENAI_API_KEY    = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// --- AI Plugin Configuration ---
const plugins = [];

// Check and configure Google AI plugin
if (GOOGLE_API_KEY) {
    plugins.push(googleAI({ apiKey: GOOGLE_API_KEY }));
    console.log('[AI Configuration] Google AI plugin configured.');
} else {
    console.warn('[AI Configuration] GOOGLE_API_KEY is missing. Google AI features will fail.');
}

// Check and configure OpenAI plugin
if (OPENAI_API_KEY) {
    plugins.push(openAI({ apiKey: OPENAI_API_KEY }));
    console.log('[AI Configuration] OpenAI plugin configured.');
} else {
    // Console warning can be noisy, consider logging level control in production
    // console.warn('[AI Configuration] OPENAI_API_KEY is missing. OpenAI features will be unavailable.');
}

// Check and configure Anthropic plugin
if (ANTHROPIC_API_KEY) {
    plugins.push(anthropic({ apiKey: ANTHROPIC_API_KEY }));
     console.log('[AI Configuration] Anthropic plugin configured.');
} else {
    // console.warn('[AI Configuration] ANTHROPIC_API_KEY is missing. Anthropic features will be unavailable.');
}

// Error if no plugins can be initialized
if (!plugins.length) {
  console.error('[AI Configuration] No API keys found. AI functionality will be severely limited or fail entirely.');
  // Depending on the application's requirements, you might throw an error here
  // throw new Error('No AI plugins could be configured due to missing API keys.');
}

// Initialize Genkit with configured plugins
// Note: The 'ai' export itself is an object, which is why 'use server'
// was causing issues if used at the top level.
// If all exported functions from this file *become* async, 'use server' could be re-added.
export const ai = genkit({
  plugins,
  // logLevel: 'debug', // Uncomment for detailed Genkit logs
});


// --- Model Selection Logic ---
// This function is synchronous and can be exported without 'use server' problems
// It returns a Genkit-compatible model string (e.g., 'googleai/gemini-1.5-flash').
export function chooseModelBasedOnPrompt(promptContent: string): string {
  const promptLength = promptContent.length;
  const promptLower = promptContent.toLowerCase();
  const availableModels: string[] = [];

  // Populate availableModels based on which keys are present
  if (GOOGLE_API_KEY)    availableModels.push('googleai/gemini-1.5-flash');
  if (OPENAI_API_KEY)    availableModels.push('openai/gpt-4o', 'openai/gpt-3.5-turbo');
  if (ANTHROPIC_API_KEY) availableModels.push('anthropic/claude-3-5-sonnet-20240620', 'anthropic/claude-3-haiku-20240307');

  if (availableModels.length === 0) {
    console.error('[AI Model Selection] No models available due to missing API keys.');
    // Fallback or error based on requirements. Returning a default to avoid crashing.
    // Consider throwing an error if AI is critical: throw new Error('No AI models available.');
    return 'googleai/gemini-1.5-flash'; // Default fallback if possible
  }

  // Prioritize specific models based on keywords if available
  if ( (promptLower.includes('graphic design') || promptLower.includes('visual critique')) && availableModels.includes('openai/gpt-4o') ) {
    return 'openai/gpt-4o';
  }
  if ( (promptLower.includes('code') || promptLower.includes('```') || promptLower.includes('debug')) && availableModels.includes('openai/gpt-4o') ) {
     return 'openai/gpt-4o';
  }
  if ( (promptLength > 1500 || promptLower.includes('analysis') || promptLower.includes('report')) && availableModels.includes('anthropic/claude-3-5-sonnet-20240620') ) {
    return 'anthropic/claude-3-5-sonnet-20240620';
  }
  if ( (promptLower.includes('creative') || promptLower.includes('story') || promptLower.includes('marketing')) && availableModels.includes('anthropic/claude-3-5-sonnet-20240620') ) {
      return 'anthropic/claude-3-5-sonnet-20240620';
  }

  // Fallback logic - Prioritize Google AI if available and no other specific match
  if (availableModels.includes('googleai/gemini-1.5-flash')) {
    return 'googleai/gemini-1.5-flash'; // Good general-purpose default
  }
  // Other fallbacks if Google isn't available
  if (availableModels.includes('anthropic/claude-3-haiku-20240307')) {
     return 'anthropic/claude-3-haiku-20240307'; // Faster/cheaper alternative
  }
  if (availableModels.includes('openai/gpt-3.5-turbo')) {
    return 'openai/gpt-3.5-turbo'; // Another fallback
  }

  // If somehow none of the specific fallbacks match, return the first available
  console.warn("[AI Model Selection] No specific model match found, returning first available:", availableModels[0]);
  return availableModels[0];
}


// --- Prompt Templates ---

// Validation Prompt Template Text
const VALIDATION_PROMPT_TEXT = `You are an AI quality assurance assistant.
Review the following ORIGINAL PROMPT and the RESPONSE generated by another AI.
Is the RESPONSE an acceptable, relevant, and high-quality answer to the ORIGINAL PROMPT?
Answer ONLY with "Acceptable" or "Unacceptable".

ORIGINAL PROMPT:
---
{{{originalPrompt}}}
---

RESPONSE:
---
{{{responseToValidate}}}
---

Assessment (Acceptable/Unacceptable):`;

// Define the validation prompt using genkit
// This 'validationPrompt' is an object, it cannot be exported if 'use server' is active
const validationPrompt = ai.definePrompt({
    name: 'validateAIResponse',
    input: { schema: z.object({ originalPrompt: z.string(), responseToValidate: z.string() }) },
    output: { schema: z.string().describe("Either 'Acceptable' or 'Unacceptable'") },
    prompt: VALIDATION_PROMPT_TEXT,
});


// --- Core AI Call Function with Cross-Validation ---
// This MUST be async to be exported from a 'use server' file
export async function callAI(originalPrompt: string, modelOverride?: string): Promise<string> {
  let primaryModelId: string;

  // 1. Choose Primary Model
  try {
    // Use override if provided, otherwise choose based on prompt content
    primaryModelId = modelOverride ?? chooseModelBasedOnPrompt(originalPrompt); // chooseModelBasedOnPrompt is sync
    console.log(`[AI Call - Primary] Using model: ${primaryModelId}`);
  } catch (err: any) {
    console.error('[AI Call Error] Failed to select primary model:', err.message);
    return `Error: Could not select an AI model. ${err.message}`;
  }

  // 2. Generate Primary Response
  let primaryResponse: string;
  try {
    console.log(`[AI Call - Primary] Calling model ${primaryModelId}...`);
    const { text } = await ai.generate({ model: primaryModelId, prompt: originalPrompt });
    if (!text) throw new Error(`Primary AI model (${primaryModelId}) returned an empty response.`);
    primaryResponse = text;
    console.log(`[AI Call - Primary] Response received from ${primaryModelId}. Length: ${primaryResponse.length}`);
  } catch (err: any) {
    console.error(`[AI Call Error - Primary ${primaryModelId}] ${err.message}`);
    return `Error generating response from ${primaryModelId}: ${err.message}`;
  }

  // 3. Select Validation Models
  const availableModels: string[] = [];
  if (GOOGLE_API_KEY)    availableModels.push('googleai/gemini-1.5-flash');
  if (OPENAI_API_KEY)    availableModels.push('openai/gpt-4o', 'openai/gpt-3.5-turbo');
  if (ANTHROPIC_API_KEY) availableModels.push('anthropic/claude-3-5-sonnet-20240620', 'anthropic/claude-3-haiku-20240307');

  const validationModels = availableModels
    .filter(modelId => modelId !== primaryModelId)
    .slice(0, 2);

  // 4. Perform Cross-Validation
  if (validationModels.length < 1) {
    console.warn(`[AI Call - Validation] Not enough distinct models available for cross-validation. Skipping.`);
    return primaryResponse;
  }

  console.log(`[AI Call - Validation] Using validators: ${validationModels.join(', ')}`);
  let validationPassedCount = 0;
  let validationFailedCount = 0;

  for (const validationModelId of validationModels) {
    console.log(`[AI Call - Validation] Requesting validation from ${validationModelId}...`);
    try {
      // Call the defined validationPrompt
      const { output: validationResult } = await validationPrompt(
        { originalPrompt, responseToValidate: primaryResponse },
        { model: validationModelId } // Specify the validation model
      );

      if (!validationResult) {
         throw new Error(`Validation model ${validationModelId} returned an empty result.`);
      }

      if (validationResult.toLowerCase().includes('acceptable')) {
        validationPassedCount++;
        console.log(`[AI Call - Validation] ${validationModelId} assessed as: Acceptable`);
      } else {
        validationFailedCount++;
        console.warn(`[AI Call - Validation] ${validationModelId} assessed as: Unacceptable (Result: ${validationResult})`);
      }
    } catch (err: any) {
      console.error(`[AI Call Error - Validation ${validationModelId}] ${err.message}`);
      validationFailedCount++; // Count errors as failures
    }
  }

  // 5. Evaluate Validation Results
  if (validationPassedCount > 0 && validationFailedCount === 0) {
      console.log(`[AI Call - Validation] Passed (${validationPassedCount} acceptable, ${validationFailedCount} unacceptable).`);
      return primaryResponse;
  } else {
      console.error(`[AI Call - Validation] FAILED (${validationPassedCount} acceptable, ${validationFailedCount} unacceptable). Primary response from ${primaryModelId} may be unreliable.`);
      console.error(`Cross-validation failed for prompt: "${originalPrompt.substring(0, 100)}..."`);
      // Return primary response despite failure, but log it. Consider adding a warning.
      // return `[Warning: Cross-validation failed] ${primaryResponse}`;
      return primaryResponse;
  }
}


// --- Static Prompt Definitions (Examples - These are objects, cannot be exported with 'use server') ---
// These should ideally be defined within the flows that use them, or imported from a separate non-'use server' file.
// Keeping them here temporarily but commenting out exports.

/* export const projectDecompositionPrompt = ai.definePrompt({ ... }); */
/* export const generateProjectIdeaPrompt = ai.definePrompt({ ... }); */
/* export const matchFreelancerPrompt = ai.definePrompt({ ... }); */

// Removed fine-tuning functions (getUserFineTunedModel, triggerFineTuningJob)
// Note: Fine-tuning logic (getUserFineTunedModel, triggerFineTuningJob) is removed
// as it's complex and requires significant infrastructure beyond basic API calls.
// It would typically involve dedicated services and asynchronous job handling.
