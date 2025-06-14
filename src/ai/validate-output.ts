'use server'; // Ensure 'use server' is at the top

/**
 * @fileOverview Cross-validation logic for AI outputs.
 * Exports:
 * - validateAIOutput (async function)
 */

import { ai } from '@/lib/ai';
import { z } from 'zod';
import { ValidationSchema, type ValidationResult } from '@/ai/schemas/validation-schema';
import { ALL_MODELS, type ModelId } from '@/lib/ai-models';

// Read environment variables once at the module level
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Define the prompt template at the module scope for reusability and testability
const validationPromptTemplate = `You are an AI evaluator. Assess if the following AI output accurately and completely fulfills the original request.
Return ONLY a JSON object with keys "isValid" (boolean) and "reasoning" (string, explanation if invalid, or brief confirmation if valid).

=== Original Request ===
{{{originalPrompt}}}

=== AI Output to Validate ===
{{{originalOutput}}}

=== Evaluation ===
Does the output strictly follow the requested format (if any) and address all parts of the original request accurately?
Is the output sensible and relevant to the request?
Respond ONLY with the JSON object: {"isValid": boolean, "reasoning": string}`;

/**
 * Performs cross-validation of an AI model's output using other available models.
 */
export async function validateAIOutput(
  originalPrompt: string,
  originalOutput: string,
  primaryModelName: ModelId // Use the strong ModelId type
): Promise<{ allValid: boolean; results: ValidationResult[] }> {
  console.log(`[AI Validation] Starting validation process...`);
  console.log(`[AI Validation] Primary Model: ${primaryModelName}`);
  console.log(`[AI Validation] Original Prompt (first 100 chars):`, originalPrompt.substring(0, 100) + '...');
  console.log(`[AI Validation] Original Output (first 100 chars):`, originalOutput.substring(0, 100) + '...');

  const validatorModels: ModelId[] = [];

  // Determine validator models based on API key availability and ensuring not to validate with the primary model itself
  if (GOOGLE_API_KEY) {
    if (primaryModelName !== ALL_MODELS.googleFast) validatorModels.push(ALL_MODELS.googleFast);
    // Optionally add googlePro if different and available
    if (primaryModelName !== ALL_MODELS.googlePro) validatorModels.push(ALL_MODELS.googlePro);
  }
  if (OPENAI_API_KEY) {
    if (primaryModelName !== ALL_MODELS.openaiMini) validatorModels.push(ALL_MODELS.openaiMini);
    if (primaryModelName !== ALL_MODELS.openaiFull) validatorModels.push(ALL_MODELS.openaiFull);
  }
  if (ANTHROPIC_API_KEY) {
    if (primaryModelName !== ALL_MODELS.anthropicHaiku) validatorModels.push(ALL_MODELS.anthropicHaiku);
    if (primaryModelName !== ALL_MODELS.anthropicSonnet) validatorModels.push(ALL_MODELS.anthropicSonnet);
    // Opus is expensive, consider if it should be a validator or only a primary
    // if (primaryModelName !== ALL_MODELS.anthropicOpus && ...) validatorModels.push(ALL_MODELS.anthropicOpus);
  }

  // Remove duplicates that might occur if, e.g., googleFast and googlePro are the same model id.
  const uniqueValidatorModels = Array.from(new Set(validatorModels));

  if (uniqueValidatorModels.length === 0) {
    console.warn(`[AI Validation] No other models available for cross-validation. Skipping.`);
    return { allValid: true, results: [] }; // Assume valid if no validators
  }

  console.log(`[AI Validation] Attempting validation using models: ${uniqueValidatorModels.join(', ')}`);

  const validationResults: ValidationResult[] = [];

  for (const modelName of uniqueValidatorModels) {
    console.log(`
[AI Validation] --- Starting validation with ${modelName} ---`);
    try {
      const validationPrompt = ai.definePrompt({
        name: `validationPrompt_${modelName.replace(/[^a-zA-Z0-9]/g, '_')}`, // Ensure unique prompt name
        input: { schema: z.object({ originalPrompt: z.string(), originalOutput: z.string() }) },
        output: { schema: ValidationSchema },
        prompt: validationPromptTemplate,
        model: modelName,
      });

      console.log(`[AI Validation] Calling ${modelName} for validation...`);
      const { output } = await validationPrompt({ originalPrompt, originalOutput });
      console.log(`[AI Validation] Raw output from ${modelName}:`, JSON.stringify(output, null, 2));

      if (output) {
        console.log(`[AI Validation] Parsing output from ${modelName}...`);
        const parsedOutput = ValidationSchema.parse(output); // Zod parse will throw if schema mismatch
        console.log(`[AI Validation] Parsed output from ${modelName}:`, parsedOutput);
        validationResults.push(parsedOutput);
      } else {
        console.warn(`[AI Validation] Validator ${modelName} returned empty or invalid output.`);
        validationResults.push({ isValid: false, reasoning: `Validator ${modelName} failed to provide valid output.` });
      }
    } catch (error: any) {
      console.error(`[AI Validation] Error validating with ${modelName}:`, error.message);
      console.error(`[AI Validation] Full error object:`, error);
      validationResults.push({ isValid: false, reasoning: `Error during validation with ${modelName}: ${error.message}` });
    }
    console.log(`[AI Validation] --- Finished validation with ${modelName} ---`);
  }

  // Compute allValid after collecting all results
  const allValid = validationResults.length > 0 && validationResults.every(r => r.isValid);

  console.log(`[AI Validation] Final overall validation result: allValid=${allValid}`);
  console.log(`[AI Validation] Detailed results:`, JSON.stringify(validationResults, null, 2));

  return { allValid, results: validationResults };
}
