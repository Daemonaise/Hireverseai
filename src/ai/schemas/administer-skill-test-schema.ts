/**
 * @fileOverview Schemas and types for the administerSkillTest flow.
 */
import { z } from 'genkit';

export const AdministerSkillTestInputSchema = z.object({
  freelancerId: z.string().describe('The unique identifier for the freelancer.'),
  skills: z.array(z.string()).min(1).describe('The list of skills the freelancer claims to possess.'),
});
export type AdministerSkillTestInput = z.infer<typeof AdministerSkillTestInputSchema>;

export const QuestionSchema = z.object({
    questionText: z.string().describe("The text of the test question."),
    skillTested: z.string().describe("The specific skill this question is designed to test."),
    // Potential future fields: questionType (multiple choice, coding, free text), options, correctAnswer
});
export type Question = z.infer<typeof QuestionSchema>;

export const AdministerSkillTestOutputSchema = z.object({
  testId: z.string().describe("A unique identifier for this specific test instance."),
  questions: z.array(QuestionSchema).describe('A list of generated test questions.'),
  instructions: z.string().describe('General instructions for the freelancer taking the test.'),
});
export type AdministerSkillTestOutput = z.infer<typeof AdministerSkillTestOutputSchema>;
