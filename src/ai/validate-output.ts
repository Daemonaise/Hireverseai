'use server';
/**
 * @fileOverview Cross-validation logic for AI outputs.
 */

import { ai } from '@/lib/ai'; // Import the base AI instance from the correct location
import { z } from 'zod';

// --- Zod Schema for Validation Output ---
// Placed before the function that uses it
const ValidationSchema = z.object({
  isValid: z.boolean().describe("Whether the original output is valid and accurate based on the original request."),
  reasoning: z.string().optional().describe("Explanation if invalid, or brief confirmation if valid."),
});
export type ValidationResult = z.infer<typeof ValidationSchema>;

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
  const allModels = {
    google: 'googleai/gemini-1.5-flash',
    openai: ['openai/gpt-4o-mini', 'openai/gpt-4o'],
    anthropic: ['anthropic/claude-3-haiku-20240307', 'anthropic/claude-3-5-sonnet-20240620']
  };

  // Re-read env vars inside this function to ensure up-to-date checks
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  if (GOOGLE_API_KEY && primaryModelName !== allModels.google) validatorModels.push(allModels.google);
  // Prefer cheaper models for validation if available
  if (OPENAI_API_KEY && !primaryModelName.startsWith('openai/')) validatorModels.push(allModels.openai[0]);
  if (ANTHROPIC_API_KEY && !primaryModelName.startsWith('anthropic/')) validatorModels.push(allModels.anthropic[0]);

  if (validatorModels.length === 0) {
    console.warn("[AI Validation] No other models available for cross-validation. Skipping.");
    return { allValid: true, results: [] }; // Assume valid if no validators
  }

  console.log(`[AI Validation] Validating output from ${primaryModelName} using models: ${validatorModels.join(', ')}`);

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
    try {
      // Define the prompt dynamically within the loop for validation
      const validationPrompt = ai.definePrompt({
          name: `validationPrompt_${modelName.replace(/[^a-zA-Z0-9]/g, '_')}`, // Unique name for dynamic prompt definition
          model: modelName, // Specify the model string directly
          input: { schema: z.object({ originalPrompt: z.string(), originalOutput: z.string() }) },
          output: { schema: ValidationSchema }, // Request JSON output
          prompt: validationPromptTemplate, // Use the template string
      });

      // Generate the validation result using the dynamically defined prompt
      const { output } = await validationPrompt({ originalPrompt, originalOutput });

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
