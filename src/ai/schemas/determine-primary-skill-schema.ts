/**
 * @fileOverview Schemas and types for the determinePrimarySkill flow.
 */
import { z } from 'zod'; // Standard Zod import

// --- Input Schema and Type ---
export const DeterminePrimarySkillInputSchema = z.object({
  skillsDescription: z.string()
    .min(10, { message: 'Skills description must be at least 10 characters.' })
    .describe('Freelancer\'s description of their skills and experience.'),
});
export type DeterminePrimarySkillInput = z.infer<typeof DeterminePrimarySkillInputSchema>;

// --- Output Schema and Type ---
export const DeterminePrimarySkillOutputSchema = z.object({
  primarySkill: z.string()
    .min(1, { message: 'Primary skill cannot be empty.' })
    .describe('The single, most prominent skill identified (e.g., "React Development", "Graphic Design").'),
  extractedSkills: z.array(z.string())
    .min(1, { message: 'At least one extracted skill must be provided.' })
    .describe('List of relevant skills extracted from the description, including the primary skill.'),
});
export type DeterminePrimarySkillOutput = z.infer<typeof DeterminePrimarySkillOutputSchema>;
