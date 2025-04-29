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

import { callAI } from '@/ai/ai-instance';
import { chooseModelBasedOnPrompt } from '@/lib/model-selector';
import { z } from 'zod';
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
  const selectedModel = chooseModelBasedOnPrompt(input.skillsDescription);

  try {
    console.log(`Determining primary skill using model: ${selectedModel}`);

    const schemaDescription = `{
  "primarySkill": "The single most prominent skill (e.g., 'React Development')",
  "extractedSkills": ["List", "of", "all", "distinct", "skills"]
}`;

    const promptText = `You are analyzing a freelancer's description of their skills and experience.
Identify:
1. The single most prominent (primary) skill.
2. A full list of all distinct skills mentioned or clearly implied.

Freelancer's Skills Description:
${input.skillsDescription}

Instructions:
- Focus on real, concrete skills (e.g., 'React Development', 'Copywriting', 'UI/UX Design').
- The primary skill should reflect their strongest or most emphasized ability.
- The extracted skills list must include the primary skill.

Return ONLY a JSON object strictly following this structure:
${schemaDescription}
Do not add any extra explanation, text, or formatting outside the JSON object.`;

    const responseString = await callAI(selectedModel, promptText);

    try {
      const cleanedResponse = responseString.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      const parsed = JSON.parse(cleanedResponse);
      const output = DeterminePrimarySkillOutputSchema.parse(parsed);

      if (!output.primarySkill || output.extractedSkills.length === 0) {
        console.warn(`AI (${selectedModel}) returned incomplete data. Defaulting to 'General'. Raw:`, parsed);
        return { primarySkill: "General", extractedSkills: ["General"] };
      }

      console.log(`Primary skill determined: ${output.primarySkill}`);
      return output;

    } catch (parseError: any) {
      console.error(`Failed to parse/validate primary skill output from AI (${selectedModel}):`, parseError.errors ?? parseError, "Raw response:", responseString);
      return { primarySkill: "General", extractedSkills: ["General"] };
    }

  } catch (error: any) {
    console.error(`Error during primary skill determination with ${selectedModel}:`, error.message ?? error);
    return { primarySkill: "General", extractedSkills: ["General"] };
  }
}
