'use server';

import { ai } from '@/lib/ai'; // Import the configured ai instance
import { chooseModelBasedOnPrompt } from '@/lib/ai-server-helpers'; // Import from correct location
import { validateAIOutput } from '@/ai/validate-output'; // Import from new location
import { z } from 'zod';
import {
  DeterminePrimarySkillInputSchema,
  type DeterminePrimarySkillInput,
  DeterminePrimarySkillOutputSchema,
  type DeterminePrimarySkillOutput,
} from '@/ai/schemas/determine-primary-skill-schema';

// Export types
export type { DeterminePrimarySkillInput, DeterminePrimarySkillOutput };

// --- Cross-Validation Logic is now imported ---

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
                // Correctly use backticks for template literal
                name: `determineSkillPrompt_${primaryModel.replace(/[^a-zA-Z0-9]/g, '_')}`,
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
