
/**
 * @fileOverview Schemas and types for the determinePrimarySkill flow.
 */
import { z } from 'zod';

// --- Input Schema and Type ---
// The input is now expected to be a full resume text.
export const DeterminePrimarySkillInputSchema = z.object({
  skillsDescription: z.string()
    .min(50, { message: 'Resume text must be at least 50 characters.' })
    .describe("The full text content of a freelancer's resume."),
});
export type DeterminePrimarySkillInput = z.infer<typeof DeterminePrimarySkillInputSchema>;

// --- Output Schema and Type ---
export const DeterminePrimarySkillOutputSchema = z.object({
  primarySkill: z.string()
    .min(1, { message: 'Primary skill cannot be empty.' })
    .describe('The single, most prominent skill or role identified from the resume (e.g., "React Development", "Graphic Design").'),
  extractedSkills: z.array(z.string().min(1))
    .min(1, { message: 'At least one extracted skill must be provided.' })
    .describe('A comprehensive list of relevant skills extracted from the resume, including the primary skill.'),
});
export type DeterminePrimarySkillOutput = z.infer<typeof DeterminePrimarySkillOutputSchema>;
