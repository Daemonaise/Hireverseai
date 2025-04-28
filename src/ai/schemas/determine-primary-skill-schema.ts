/**
 * @fileOverview Schemas and types for the determinePrimarySkill flow.
 */
import { z } from 'genkit';

export const DeterminePrimarySkillInputSchema = z.object({
  skillsDescription: z.string().min(10).describe('The freelancer\'s description of their skills and experience.'),
});
export type DeterminePrimarySkillInput = z.infer<typeof DeterminePrimarySkillInputSchema>;

export const DeterminePrimarySkillOutputSchema = z.object({
  primarySkill: z.string().describe('The single, most prominent skill identified from the description (e.g., "React Development", "Graphic Design", "Copywriting").'),
  extractedSkills: z.array(z.string()).describe('A list of all relevant skills extracted from the description, including the primary skill.'),
});
export type DeterminePrimarySkillOutput = z.infer<typeof DeterminePrimarySkillOutputSchema>;
