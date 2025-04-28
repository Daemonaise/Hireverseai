
/**
 * @fileOverview Schemas and types for the gradeAssessmentAnswer flow.
 */
import { z } from 'genkit';
import type { DifficultyLevel } from './generate-assessment-question-schema'; // Import difficulty type

// Define potential flags
export const AnswerFlagsSchema = z.enum(['ai_generated_suspected', 'irrelevant', 'too_short', 'plagiarized_suspected', 'profane']);
export type AnswerFlags = z.infer<typeof AnswerFlagsSchema>;

export const GradeAssessmentAnswerInputSchema = z.object({
  freelancerId: z.string().describe("ID of the freelancer being assessed."),
  questionId: z.string().describe("The unique ID of the question being answered."),
  questionText: z.string().describe("The text of the assessment question."),
  skillTested: z.string().describe("The specific skill the question was designed to test."),
  difficulty: z.string().describe("The difficulty level of the question (e.g., 'beginner', 'intermediate')."), // Keep as string from GenerateAssessmentOutput
  answerText: z.string().describe("The freelancer's submitted answer."),
  primarySkill: z.string().describe('The main skill being assessed overall in the test.'),
});
export type GradeAssessmentAnswerInput = z.infer<typeof GradeAssessmentAnswerInputSchema>;

export const GradeAssessmentAnswerOutputSchema = z.object({
    questionId: z.string().describe("Matches the input questionId."),
    score: z.number().int().min(0).max(100).describe("The calculated score for this answer (0-100)."),
    feedback: z.string().describe("Specific feedback on the freelancer's answer, highlighting strengths and weaknesses."),
    flags: z.array(AnswerFlagsSchema).optional().describe("List of any flags raised for this answer (e.g., suspected AI generation)."),
    suggestedNextDifficulty: z.string().describe("Suggested difficulty for the *next* question based on performance on this one ('easier', 'same', 'harder')."),
});
export type GradeAssessmentAnswerOutput = z.infer<typeof GradeAssessmentAnswerOutputSchema>;

