

/**
 * @fileOverview Determines the primary skill from a freelancer's description.
 * Uses the default Google AI model.
 *
 * Exports:
 * - determinePrimarySkill - A function that identifies the main skill and extracts others.
 */

import { ai } from '@/ai/ai-instance'; // Import the configured 'ai' instance
import { z } from 'genkit';
import {
    DeterminePrimarySkillInputSchema,
    type DeterminePrimarySkillInput, // Keep type import for internal use
    DeterminePrimarySkillOutputSchema,
    type DeterminePrimarySkillOutput, // Export output type
} from '@/ai/schemas/determine-primary-skill-schema'; // Import schemas/types

// 'use server'; - Not needed here, it's a standard async function
export async function determinePrimarySkill(input: DeterminePrimarySkillInput): Promise<DeterminePrimarySkillOutput> {
  return determinePrimarySkillFlow(input);
}

const prompt = ai.definePrompt({
  name: 'determinePrimarySkillPrompt',
  input: { schema: DeterminePrimarySkillInputSchema },
  output: { schema: DeterminePrimarySkillOutputSchema },
  prompt: `Analyze the following skills description provided by a freelancer.
Identify the single most prominent or primary skill they possess based on their description.
Also, extract a list of all distinct skills mentioned or clearly implied.

Skills Description:
{{{skillsDescription}}}

Focus on concrete abilities and expertise. The primary skill should be the one most emphasized or central to their description. The extracted skills list should include the primary skill and any other relevant skills identified.

Return the result strictly following the output schema, providing 'primarySkill' and 'extractedSkills'.`,
  // Model defaults to the one configured in ai-instance.ts
  config: {
      temperature: 0.2, // Lower temperature for more deterministic skill identification
  },
});

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
     try {
        // Call the prompt using the default model
        const { output } = await prompt(input);
        if (!output || !output.primarySkill || !output.extractedSkills || output.extractedSkills.length === 0) {
            console.warn("Primary skill determination failed or returned empty results for description:", input.skillsDescription);
            // Consider returning a more specific error or default values
            return { primarySkill: "General", extractedSkills: ["General"] }; // Example fallback
            // throw new Error("Could not determine primary skill or extract skills from the provided description.");
        }
        return output;
     } catch (error: any) {
         console.error("Error in determinePrimarySkillFlow:", error);
         if (error.message?.includes('API key')) {
             console.error(`Ensure your GOOGLE_API_KEY is valid and has permissions.`);
         } else if (error.message?.includes('INVALID_ARGUMENT')) {
             console.error(`Invalid argument error during skill determination. Check prompt/schema. Error:`, error.details);
         }
         // Return a fallback response instead of throwing to allow signup flow to continue
         return { primarySkill: "General", extractedSkills: ["General"] }; // Example fallback
         // throw new Error(`Failed to determine primary skill: ${error.message}`);
     }
  }
);
