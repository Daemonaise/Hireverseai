'use server';
/**
 * @fileOverview Determines the primary skill from a freelancer's description.
 * Uses dynamic model selection based on the description content.
 *
 * Exports:
 * - determinePrimarySkill - A function that identifies the main skill and extracts others.
 */

import { ai, chooseModelBasedOnPrompt } from '@/ai/ai-instance'; // Import chooseModelBasedOnPrompt
import { z } from 'genkit';
import {
    DeterminePrimarySkillInputSchema, // Import schema definition
    type DeterminePrimarySkillInput, // Export type only
    DeterminePrimarySkillOutputSchema, // Import schema definition
    type DeterminePrimarySkillOutput, // Export type only
} from '@/ai/schemas/determine-primary-skill-schema';

// Define prompt generator function
// Keep internal, do not export
const createPrimarySkillPrompt = (modelName: string) => ai.definePrompt({
  name: `determinePrimarySkillPrompt_${modelName.replace(/[^a-zA-Z0-9]/g, '_')}`,
  input: { schema: DeterminePrimarySkillInputSchema },
  output: { schema: DeterminePrimarySkillOutputSchema },
  model: modelName, // Use dynamically selected model
  prompt: `Analyze the following skills description provided by a freelancer.
Identify the single most prominent or primary skill they possess based on their description.
Also, extract a list of all distinct skills mentioned or clearly implied.

Skills Description:
{{{skillsDescription}}}

Focus on concrete abilities and expertise. The primary skill should be the one most emphasized or central to their description. The extracted skills list should include the primary skill and any other relevant skills identified.

Return the result strictly following the output schema, providing 'primarySkill' and 'extractedSkills'.`,
  config: {
      temperature: 0.2, // Lower temperature for more deterministic skill identification
  },
});

// Export only the async wrapper function and types
export type { DeterminePrimarySkillInput, DeterminePrimarySkillOutput };

export async function determinePrimarySkill(input: DeterminePrimarySkillInput): Promise<DeterminePrimarySkillOutput> {
  return determinePrimarySkillFlow(input);
}

// Keep internal, do not export
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
     // Choose model based on the skill description - Await the async function
     const selectedModel = await chooseModelBasedOnPrompt(input.skillsDescription);
     console.log(`Determining primary skill using model: ${selectedModel}`);

     try {
        // Create the specific prompt definition
        const primarySkillPrompt = createPrimarySkillPrompt(selectedModel);

        // Call the dynamically created prompt
        const { output } = await primarySkillPrompt(input);

        if (!output || !output.primarySkill || !output.extractedSkills || output.extractedSkills.length === 0) {
            console.warn(`Primary skill determination failed or returned empty results using ${selectedModel} for description:`, input.skillsDescription);
            return { primarySkill: "General", extractedSkills: ["General"] }; // Fallback
        }
        return output;
     } catch (error: any) {
         console.error(`Error in determinePrimarySkillFlow using ${selectedModel}:`, error);
         if (error.message?.includes('API key')) {
             console.error(`Ensure your GOOGLE_API_KEY (or other configured keys) is valid and has permissions.`);
         } else if (error.message?.includes('INVALID_ARGUMENT')) {
             console.error(`Invalid argument error during skill determination using ${selectedModel}. Check prompt/schema. Error:`, error.details);
         }
         return { primarySkill: "General", extractedSkills: ["General"] }; // Fallback
     }
  }
);
