/**
 * @fileOverview Schemas and types for the gradeAssessmentAnswer flow.
 */
import { z } from 'zod';
import type { DifficultyLevel } from './generate-assessment-question-schema'; // Correct external type import

// --- Flags Enum ---
export const AnswerFlagsSchema = z.enum([
  'ai_generated_suspected',
  'irrelevant',
  'too_short',
  'plagiarized_suspected',
  'profane',
]);
export type AnswerFlags = z.infer<typeof AnswerFlagsSchema>;

// --- Input Schema and Type ---
export const GradeAssessmentAnswerInputSchema = z.object({
  freelancerId: z.string().describe('ID of the freelancer being assessed.'),
  questionId: z.string().describe('Unique ID of the question being answered.'),
  questionText: z.string().describe('Text of the assessment question.'),
  skillTested: z.string().describe('Specific skill the question is designed to test.'),
  difficulty: z.string().describe('Difficulty level of the question (e.g., "beginner", "intermediate", etc.).'), // Keeping string for flexibility, even if internally we use DifficultyLevel
  answerText: z.string().describe('The freelancer\'s submitted answer.'),
  primarySkill: z.string().describe('Main skill being assessed in the overall test.'),
});
export type GradeAssessmentAnswerInput = z.infer<typeof GradeAssessmentAnswerInputSchema>;

// --- Output Schema and Type ---
export const GradeAssessmentAnswerOutputSchema = z.object({
  questionId: z.string().describe('Matches the input questionId.'),
  score: z.number().int().min(0).max(100).describe('Calculated score for this answer (0-100).'),
  feedback: z.string().describe('Specific feedback highlighting strengths and weaknesses.'),
  flags: z.array(AnswerFlagsSchema).optional().describe('Flags raised for this answer (e.g., suspected AI generation).'),
  suggestedNextDifficulty: z.enum(['easier', 'same', 'harder']).describe('Suggested difficulty for the next question.'),
});
export type GradeAssessmentAnswerOutput = z.infer<typeof GradeAssessmentAnswerOutputSchema>;
