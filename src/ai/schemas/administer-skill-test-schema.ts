/**
 * @fileOverview Schemas and types for the administerSkillTest flow.
 */
import { z } from 'zod'; // Standard Zod import

// --- Input Schema and Type ---
export const AdministerSkillTestInputSchema = z.object({
  freelancerId: z.string().describe('The unique identifier for the freelancer.'),
  skills: z.array(z.string()).min(1).describe('List of skills the freelancer claims to possess (at least one).'),
});
export type AdministerSkillTestInput = z.infer<typeof AdministerSkillTestInputSchema>;

// --- Single Question Schema and Type ---
export const QuestionSchema = z.object({
  questionText: z.string().describe('The text of the assessment question.'),
  skillTested: z.string().describe('The specific skill this question is intended to test.'),
});
export type Question = z.infer<typeof QuestionSchema>;

// --- Output Schema and Type ---
export const AdministerSkillTestOutputSchema = z.object({
  testId: z.string().describe('Unique identifier for this test session.'),
  questions: z.array(QuestionSchema).min(1).describe('Array of generated assessment questions (at least one required).'),
  instructions: z.string().describe('General instructions provided to the freelancer before starting the test.'),
});
export type AdministerSkillTestOutput = z.infer<typeof AdministerSkillTestOutputSchema>;
