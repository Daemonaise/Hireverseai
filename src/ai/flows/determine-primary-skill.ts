
'use server';
/**
 * @fileOverview Determines the primary skill from a freelancer's description.
 * Uses dynamic model selection based on the description content.
 *
 * Exports:
 * - determinePrimarySkill - A function that identifies the main skill and extracts others.
 * - DeterminePrimarySkillInput - Input type.
 * - DeterminePrimarySkillOutput - Output type.
 */

// Correctly import from the ai-instance module
import { chooseModelBasedOnPrompt, callAI } from '@/ai/ai-instance';
import { z } from 'zod'; // Use standard zod import
import {
    DeterminePrimarySkillInputSchema,
    type DeterminePrimarySkillInput,
    DeterminePrimarySkillOutputSchema,
    type DeterminePrimarySkillOutput,
} from '@/ai/schemas/determine-primary-skill-schema';

// Export types
export type { DeterminePrimarySkillInput, DeterminePrimarySkillOutput };

// Main exported function
export async function determinePrimarySkill(input: DeterminePrimarySkillInput): Promise<DeterminePrimarySkillOutput> {
    try {
        // 1. Choose model
        // Correctly use the imported function
        const selectedModel = chooseModelBasedOnPrompt(input.skillsDescription);
        console.log(`Determining primary skill using model: ${selectedModel}`);

        // 2. Construct prompt
        const schemaDescription = `{
  "primarySkill": "The single most prominent skill (e.g., 'React Development')",
  "extractedSkills": ["List", "of", "all", "distinct", "skills"]
}`;
        const promptText = `Analyze the following skills description provided by a freelancer.
Identify the single most prominent or primary skill they possess based on their description.
Also, extract a list of all distinct skills mentioned or clearly implied.

Skills Description:
${input.skillsDescription}

Focus on concrete abilities and expertise. The primary skill should be the one most emphasized or central to their description. The extracted skills list should include the primary skill and any other relevant skills identified.

Return ONLY a JSON object strictly following this structure:
${schemaDescription}
Do not include any explanations or introductory text outside the JSON object.`;

        // 3. Call AI using the unified function
        const responseString = await callAI(selectedModel, promptText);

        // 4. Parse and validate response
        try {
            // Clean potential markdown code block fences
            const cleanedResponse = responseString.replace(/^```json\n?/, '').replace(/\n?```$/, '');
            const parsed = JSON.parse(cleanedResponse);
            const output = DeterminePrimarySkillOutputSchema.parse(parsed);

            if (!output || !output.primarySkill || !output.extractedSkills || output.extractedSkills.length === 0) {
                console.warn(`Primary skill determination failed or returned empty results using ${selectedModel} for description:`, input.skillsDescription, "Parsed Output:", output);
                // Fallback if parsing succeeded but data is missing
                return { primarySkill: "General", extractedSkills: ["General"] };
            }
            return output;

        } catch (parseError: any) {
            console.error(`Error parsing/validating AI response for skill determination using ${selectedModel}:`, parseError.errors ?? parseError, "Raw Response:", responseString);
            // Fallback on parsing error
            return { primarySkill: "General", extractedSkills: ["General"] };
        }

    } catch (error: any) {
        console.error(`Error in determinePrimarySkill function using ${selectedModel}:`, error);
        // Fallback on general API call error
        return { primarySkill: "General", extractedSkills: ["General"] };
    }
}
