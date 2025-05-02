'use server';

import { ai, chooseModelBasedOnPrompt } from '@/ai/ai-instance'; // Import the configured ai instance and helpers
import { z } from 'zod';
import {
  DeterminePrimarySkillInputSchema,
  type DeterminePrimarySkillInput,
  DeterminePrimarySkillOutputSchema,
  type DeterminePrimarySkillOutput,
} from '@/ai/schemas/determine-primary-skill-schema';

export type { DeterminePrimarySkillInput, DeterminePrimarySkillOutput };

// --- Cross-Validation Logic (Included within the flow file) ---
const ValidationSchema = z.object({
  isValid: z.boolean().describe("Whether the original output is valid and accurate based on the original request."),
  reasoning: z.string().optional().describe("Explanation if invalid, or brief confirmation if valid."),
});
type ValidationResult = z.infer<typeof ValidationSchema>;

async function validateAIOutput(
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
      const validationAI = ai.defineModel({
          name: `validationModel_${modelName.replace(/[^a-zA-Z0-9]/g, '_')}`,
          model: modelName,
          output: { schema: ValidationSchema }, // Ensure the model tries to output in the correct format
      });

      const { output } = await validationAI.generate({
        prompt: validationPrompt,
        output: { schema: ValidationSchema } // Reiterate schema for clarity
      });

      if (output) {
        const parsedOutput = ValidationSchema.parse(output); // Validate the structure
        validationResults.push(parsedOutput);
        if (!parsedOutput.isValid) {
          allValid = false;
        }
         console.log(`[AI Validation] Validator ${modelName} result: isValid=${parsedOutput.isValid}`);
      } else {
        console.warn(`[AI Validation] Validator ${modelName} returned empty or invalid output.`);
        validationResults.push({ isValid: false, reasoning: `Validator ${modelName} failed to provide valid JSON.` });
        allValid = false; // Treat empty output as failure
      }
    } catch (error: any) {
      console.error(`[AI Validation] Error validating with ${modelName}:`, error.message);
      validationResults.push({ isValid: false, reasoning: `Error during validation with ${modelName}: ${error.message}` });
      allValid = false; // Treat error as failure
    }
  }

  console.log(`[AI Validation] Final validation result: allValid=${allValid}`);
  return { allValid, results: validationResults };
}
// --- End Cross-Validation Logic ---


// --- Define the Prompt Template ---
const determineSkillPromptTemplate = `You are analyzing a freelancer's skills description.
Identify:
1. The single most prominent (primary) skill.
2. All distinct skills mentioned or implied.

Description:
{{{skillsDescription}}}

Return ONLY a valid JSON object with the following structure:
{
  "primarySkill": "string (non-empty)",
  "extractedSkills": ["string", "..."] (array of non-empty strings, at least one)
}`;


// --- Define the Flow ---
const determinePrimarySkillFlow = ai.defineFlow<
    typeof DeterminePrimarySkillInputSchema,
    typeof DeterminePrimarySkillOutputSchema
>(
    {
        name: 'determinePrimarySkillFlow',
        inputSchema: DeterminePrimarySkillInputSchema,
        outputSchema: DeterminePrimarySkillOutputSchema,
    },
    async (input) => {
        console.log(`Determining primary skill for description starting with: "${input.skillsDescription.substring(0, 50)}..."`);

        try {
            // 1. Choose the primary model for generation
            const primaryModel = await chooseModelBasedOnPrompt(input.skillsDescription);
            console.log(`Using model ${primaryModel} for skill determination.`);

            // 2. Define the prompt using the chosen model and template
            const determineSkillPrompt = ai.definePrompt({
                name: `determineSkillPrompt_${primaryModel.replace(/[^a-zA-Z0-9]/g, '_')}`, // Dynamic name
                input: { schema: DeterminePrimarySkillInputSchema },
                output: { schema: DeterminePrimarySkillOutputSchema },
                prompt: determineSkillPromptTemplate,
                model: primaryModel,
            });

            // 3. Call the defined prompt
            const { output } = await determineSkillPrompt(input);

            if (!output) {
                throw new Error(`AI (${primaryModel}) did not return a valid JSON object for skills.`);
            }

            // 4. Validate the AI's output structure (already done by prompt definition)
            // Additional checks if needed (e.g., ensuring skills aren't empty strings)
            if (!output.primarySkill) throw new Error("Primary skill cannot be empty.");
            if (!output.extractedSkills || output.extractedSkills.length === 0 || output.extractedSkills.some(s => !s)) {
                throw new Error("Extracted skills cannot be empty or contain empty strings.");
            }

            // 5. Validate the output with other models
            const originalPromptText = determineSkillPromptTemplate
                .replace('{{{skillsDescription}}}', input.skillsDescription);

            const validation = await validateAIOutput(originalPromptText, JSON.stringify(output), primaryModel);

            if (!validation.allValid) {
                console.warn(`Validation failed for skill determination. Reasoning:`, validation.results);
                // Optionally, retry or use fallback
                throw new Error(`Skill determination failed cross-validation.`);
            }

            console.log(`Determined primary skill: ${output.primarySkill}, Extracted: ${output.extractedSkills.join(', ')}`);
            return output;

        } catch (error: any) {
            console.error(`Error in determinePrimarySkill flow:`, error?.message || error);
            // Return a default value on error
            return { primarySkill: 'General', extractedSkills: ['General'] };
        }
    }
);


// --- Main Exported Function (Wrapper) ---
export async function determinePrimarySkill(
  input: DeterminePrimarySkillInput
): Promise<DeterminePrimarySkillOutput> {
  // Input validation handled by the flow
  DeterminePrimarySkillInputSchema.parse(input);
  return determinePrimarySkillFlow(input);
}
