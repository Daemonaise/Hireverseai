
'use server';
/**
 * @fileOverview Determines primary and extracts all skills from a freelancer's resume text.
 * Exports:
 * - determinePrimarySkill (async function)
 */

import { ai } from '@/lib/ai';
import { z } from 'zod';
import {
  DeterminePrimarySkillInputSchema,
  type DeterminePrimarySkillInput,
  DeterminePrimarySkillOutputSchema,
  type DeterminePrimarySkillOutput,
} from '@/ai/schemas/determine-primary-skill-schema';

// Define prompt template for resume analysis
const determineSkillFromResumePromptTemplate = `You are an expert technical recruiter analyzing a freelancer's resume. Your goal is to identify their primary area of expertise and all other relevant skills.

Analyze the following resume text:
---
{{{skillsDescription}}}
---

Based on the entire resume, perform the following actions:
1.  Identify the single most prominent skill or role. This should be the area where the candidate has the most significant experience or focus (e.g., "Senior React Developer", "UX/UI Designer", "Data Scientist"). This will be the 'primarySkill'.
2.  Extract a comprehensive list of all distinct technical skills, software, and methodologies mentioned. These are the 'extractedSkills'. Include the primary skill in this list.

Return ONLY a valid JSON object with the following structure:
{
  "primarySkill": "string (the single most prominent skill or role, non-empty)",
  "extractedSkills": ["string", "..."] (array of all distinct skills, non-empty)
}`;

const determinePrimarySkillFlow = ai.defineFlow(
  {
    name: 'determinePrimarySkillFlow',
    inputSchema: DeterminePrimarySkillInputSchema,
    outputSchema: DeterminePrimarySkillOutputSchema,
  },
  async (input) => {
    console.log(`Determining primary skill from resume starting with: "${input.skillsDescription.substring(0, 80)}..."`);

    try {
      const determineSkillPrompt = ai.definePrompt({
        name: 'determineSkillFromResumePrompt',
        input: { schema: DeterminePrimarySkillInputSchema },
        output: { schema: DeterminePrimarySkillOutputSchema },
        prompt: determineSkillFromResumePromptTemplate,
      });

      const { output } = await determineSkillPrompt(input);

      if (!output) {
        throw new Error('AI did not return a valid JSON object for skills.');
      }

      if (!output.primarySkill || output.extractedSkills.length === 0) {
        throw new Error('AI failed to identify a primary skill or extract any skills.');
      }

      console.log(`Determined primary skill: ${output.primarySkill}, Extracted: ${output.extractedSkills.length} skills`);
      return output;
    } catch (error: any) {
      console.error('Error in determinePrimarySkill flow:', error?.message || error);
      // On failure, return a generic result to prevent breaking the signup flow.
      return { primarySkill: 'Generalist', extractedSkills: ['Generalist'] };
    }
  }
);

/**
 * Analyzes a freelancer's resume text to determine their primary skill and extract all skills.
 * @param input - The input object containing the resume text.
 * @returns A promise that resolves to the primary skill and a list of all extracted skills.
 */
export async function determinePrimarySkill(
  input: DeterminePrimarySkillInput
): Promise<DeterminePrimarySkillOutput> {
  DeterminePrimarySkillInputSchema.parse(input);
  return determinePrimarySkillFlow(input);
}
