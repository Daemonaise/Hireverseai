'use server';
/**
 * @fileOverview Cross-validation logic for AI outputs.
 * Exports:
 * - validateAIOutput (async function)
 */

import { ai } from '@/lib/ai'; // Import the base AI instance from the correct location
import { z } from 'zod';
import { ValidationSchema, type ValidationResult } from '@/ai/schemas/validation-schema'; // Import schema and type

/**
 * Performs cross-validation of an AI model's output using other available models.
 * This function is a server action and must be called from a server context.
 */
export async function validateAIOutput(
  originalPrompt: string,
  originalOutput: string,
  primaryModelName: string
): Promise<{ allValid: boolean; results: ValidationResult[] }> {

  console.log(`[AI Validation] Starting validation process...`);
  console.log(`[AI Validation] Primary Model: ${primaryModelName}`);
  console.log(`[AI Validation] Original Prompt (first 100 chars):`, originalPrompt.substring(0, 100) + "...");
  console.log(`[AI Validation] Original Output (first 100 chars):`, originalOutput.substring(0, 100) + "...");

  const validatorModels: string[] = [];
  // Updated model identifiers for validation
  const allModels = {
    google: 'googleai/gemini-1.5-flash', // Use Flash for faster validation
    openai: 'openai/gpt-4o-mini', // Use Mini for faster/cheaper validation
    anthropic: 'anthropic/claude-3-haiku-20240307', // Use Haiku for faster/cheaper validation
    anthropicSonnet: 'anthropic/claude-3-5-sonnet-20240620' // Corrected Sonnet 3.5 identifier with date
  };

  // Re-read env vars inside this function to ensure up-to-date checks
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  // Determine validator models based on availability and ensuring not to validate with the primary model itself
  if (GOOGLE_API_KEY && primaryModelName !== allModels.google) validatorModels.push(allModels.google);
  if (OPENAI_API_KEY && primaryModelName !== allModels.openai) validatorModels.push(allModels.openai);
  if (ANTHROPIC_API_KEY) {
       // Add Anthropic models if available and not the primary model
       if (primaryModelName !== allModels.anthropic) validatorModels.push(allModels.anthropic);
       // Also consider Sonnet for validation if it wasn't the primary model
       if (primaryModelName !== allModels.anthropicSonnet) validatorModels.push(allModels.anthropicSonnet);
  }


  if (validatorModels.length === 0) {
    console.warn(`[AI Validation] No other models available for cross-validation. Skipping.`);
    return { allValid: true, results: [] }; // Assume valid if no validators
  }

  console.log(`[AI Validation] Attempting validation using models: ${validatorModels.join(', ')}`);

  // Define the prompt template locally
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

  const validationResults: ValidationResult[] = [];
  let allValid = true;

  for (const modelName of validatorModels) {
    console.log(`
[AI Validation] --- Starting validation with ${modelName} ---`);
    try {
      // Define the prompt dynamically within the loop for validation
      // Use the imported `ai` instance to define the prompt
      const validationPrompt = ai.definePrompt({
          name: `validationPrompt_${modelName.replace(/[^a-zA-Z0-9]/g, '_')}`, // Correctly use backticks for template literal
          input: { schema: z.object({ originalPrompt: z.string(), originalOutput: z.string() }) },
          output: { schema: ValidationSchema }, // Request JSON output
          prompt: validationPromptTemplate, // Use the template variable directly
          model: modelName, // Specify the model string directly
      });


      // Generate the validation result using the dynamically defined prompt
      console.log(`[AI Validation] Calling ${modelName} for validation...`);
      const { output } = await validationPrompt({ originalPrompt, originalOutput });
      console.log(`[AI Validation] Raw output from ${modelName}:`, JSON.stringify(output, null, 2)); // Log raw output

      if (output) {
         console.log(`[AI Validation] Parsing output from ${modelName}...`);
         const parsedOutput = ValidationSchema.parse(output);
         console.log(`[AI Validation] Parsed output from ${modelName}:`, parsedOutput);
         validationResults.push(parsedOutput);
         if (!parsedOutput.isValid) {
           console.log(`[AI Validation] ${modelName} reported INVALID.`);
           allValid = false;
         } else {
            console.log(`[AI Validation] ${modelName} reported VALID.`);
         }
      } else {
        console.warn(`[AI Validation] Validator ${modelName} returned empty output.`);
        validationResults.push({ isValid: false, reasoning: `Validator ${modelName} failed to provide valid output.` });
        allValid = false;
      }
    } catch (error: any) {
        console.error(`[AI Validation] Error validating with ${modelName}:`, error.message);
        console.error(`[AI Validation] Full error object:`, error);
        validationResults.push({ isValid: false, reasoning: `Error during validation with ${modelName}: ${error.message}` });
        allValid = false;
    }
    console.log(`[AI Validation] --- Finished validation with ${modelName} ---`);
  }

  console.log(`[AI Validation] Final overall validation result: allValid=${allValid}`);
  console.log(`[AI Validation] Detailed results:`, JSON.stringify(validationResults, null, 2));

  return { allValid, results: validationResults };
}
