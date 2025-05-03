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

  console.log("[AI Validation] Starting validation process...");
  console.log(`[AI Validation] Primary Model: ${primaryModelName}`);
  console.log("[AI Validation] Original Prompt (first 100 chars):", originalPrompt.substring(0, 100) + "...");
  console.log("[AI Validation] Original Output (first 100 chars):", originalOutput.substring(0, 100) + "...");

  const validatorModels: string[] = [];
  const allModels = {
    google: 'googleai/gemini-1.5-flash',
    // Use gpt-4o-mini as the cost-effective OpenAI validator
    openai: ['openai/gpt-4o-mini'],
    // Use Haiku as the cost-effective Anthropic validator
    anthropic: ['anthropic/claude-3-haiku-20240307']
  };

  // Re-read env vars inside this function to ensure up-to-date checks
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  // Determine validator models
  if (GOOGLE_API_KEY && primaryModelName !== allModels.google) validatorModels.push(allModels.google);
  if (OPENAI_API_KEY && !primaryModelName.startsWith('openai/')) validatorModels.push(allModels.openai[0]);
  if (ANTHROPIC_API_KEY && !primaryModelName.startsWith('anthropic/')) validatorModels.push(allModels.anthropic[0]);

  if (validatorModels.length === 0) {
    console.warn("[AI Validation] No other models available for cross-validation. Skipping.");
    return { allValid: true, results: [] }; // Assume valid if no validators
  }

  console.log(`[AI Validation] Attempting validation using models: ${validatorModels.join(', ')}`);

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
          name: `validationPrompt_${modelName.replace(/[^a-zA-Z0-9]/g, '_')}`, // Unique name for dynamic prompt definition
          input: { schema: z.object({ originalPrompt: z.string(), originalOutput: z.string() }) },
          output: { schema: ValidationSchema }, // Request JSON output
          prompt: validationPromptTemplate, // Use the template string
          model: modelName, // Specify the model string directly
      });


      // Generate the validation result using the dynamically defined prompt
      console.log(`[AI Validation] Calling ${modelName} for validation...`);
      // Destructure only 'output' as 'debugInfo' is not guaranteed
      const { output } = await validationPrompt({ originalPrompt, originalOutput });
      console.log(`[AI Validation] Raw output from ${modelName}:`, JSON.stringify(output, null, 2)); // Log raw output

      // Removed logging for debugInfo as it's not consistently available

      if (output) {
         // Attempt to parse the output against the schema
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
        // Handle cases where the validator model returns null/undefined
        console.warn(`[AI Validation] Validator ${modelName} returned empty output.`);
        validationResults.push({ isValid: false, reasoning: `Validator ${modelName} failed to provide valid output.` });
        allValid = false;
      }
    } catch (error: any) {
        // Handle Zod parsing errors or other generation errors
        console.error(`[AI Validation] Error validating with ${modelName}:`, error.message);
        // Log the error object for more details if needed
        console.error("[AI Validation] Full error object:", error);
        validationResults.push({ isValid: false, reasoning: `Error during validation with ${modelName}: ${error.message}` });
        allValid = false;
    }
    console.log(`[AI Validation] --- Finished validation with ${modelName} ---`); // Fixed unterminated template literal
  }

  // Fixed corrupted logging line
  console.log(`[AI Validation] Final overall validation result: allValid=${allValid}`);
  console.log("[AI Validation] Detailed results:", JSON.stringify(validationResults, null, 2));

  // Added explicit return statement
  return { allValid, results: validationResults };
}
