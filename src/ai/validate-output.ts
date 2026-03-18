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
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
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
  primaryModelName: string // Use string for broader compatibility
): Promise<{ allValid: boolean; results: ValidationResult[] }> {

  const validatorModels: ModelId[] = [];
  
  // Create a map from model name (string) to model ID object
  const modelNameToIdMap = new Map<string, ModelId>(Object.values(ALL_MODELS).map(m => [m.name, m]));

  // Determine validator models based on API key availability and ensuring not to validate with the primary model itself
  if (GOOGLE_CLOUD_PROJECT) {
    if (primaryModelName !== ALL_MODELS.googleFlash.name) validatorModels.push(ALL_MODELS.googleFlash);
  }
  if (OPENAI_API_KEY) {
    if (primaryModelName !== ALL_MODELS.openaiMini.name) validatorModels.push(ALL_MODELS.openaiMini);
  }
  if (ANTHROPIC_API_KEY) {
    if (primaryModelName !== ALL_MODELS.anthropicSonnet.name) validatorModels.push(ALL_MODELS.anthropicSonnet);
  }

  // Remove duplicates that might occur if, e.g., googleFast and googlePro are the same model id.
  const uniqueValidatorModels = Array.from(new Set(validatorModels));

  if (uniqueValidatorModels.length === 0) {
    return { allValid: true, results: [] }; // Assume valid if no validators
  }


  const validationResults: ValidationResult[] = [];

  for (const model of uniqueValidatorModels) {
[AI Validation] --- Starting validation with ${model.name} ---`);
    try {
      const validationPrompt = ai.definePrompt({
        name: `validationPrompt_${model.name.replace(/[^a-zA-Z0-9]/g, '_')}`, // Ensure unique prompt name
        input: { schema: z.object({ originalPrompt: z.string(), originalOutput: z.string() }) },
        output: { schema: ValidationSchema },
        prompt: validationPromptTemplate,
        model: model, // Pass the ModelId object here
      });

      const { output } = await validationPrompt({ originalPrompt, originalOutput });

      if (output) {
        const parsedOutput = ValidationSchema.parse(output); // Zod parse will throw if schema mismatch
        validationResults.push(parsedOutput);
      } else {
        validationResults.push({ isValid: false, reasoning: `Validator ${model.name} failed to provide valid output.` });
      }
    } catch (error: any) {
      validationResults.push({ isValid: false, reasoning: `Error during validation with ${model.name}: ${error.message}` });
    }
  }

  // Compute allValid after collecting all results
  const allValid = validationResults.length > 0 && validationResults.every(r => r.isValid);


  return { allValid, results: validationResults };
}
