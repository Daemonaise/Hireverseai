'use server';

import { ai } from '@/ai/ai-instance'; // Import the configured ai instance
import { z } from 'zod';
import {
  DeterminePrimarySkillInputSchema,
  type DeterminePrimarySkillInput,
  DeterminePrimarySkillOutputSchema,
  type DeterminePrimarySkillOutput,
} from '@/ai/schemas/determine-primary-skill-schema';

export type { DeterminePrimarySkillInput, DeterminePrimarySkillOutput };

// --- Define the Prompt ---
const determineSkillPrompt = ai.definePrompt({
    name: 'determineSkillPrompt',
    input: { schema: DeterminePrimarySkillInputSchema },
    output: { schema: DeterminePrimarySkillOutputSchema },
    // model: 'googleai/gemini-1.5-flash', // Example: Specify model if needed
    prompt: `You are analyzing a freelancer's skills description.
Identify:
1. The single most prominent (primary) skill.
2. All distinct skills mentioned or implied.

Description:
{{{skillsDescription}}}

Return ONLY a valid JSON object with the following structure:
{
  "primarySkill": "string (non-empty)",
  "extractedSkills": ["string", "..."] (array of non-empty strings, at least one)
}`,
});


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
            // Call the defined prompt
            const { output } = await determineSkillPrompt(input);

            if (!output) {
                throw new Error('AI did not return a valid JSON object for skills.');
            }

            // Validate the AI's output against the schema (already done by prompt definition)
            // Additional checks if needed (e.g., ensuring skills aren't empty strings)
            if (!output.primarySkill) throw new Error("Primary skill cannot be empty.");
            if (!output.extractedSkills || output.extractedSkills.length === 0 || output.extractedSkills.some(s => !s)) {
                throw new Error("Extracted skills cannot be empty or contain empty strings.");
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
