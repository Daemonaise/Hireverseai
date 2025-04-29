/**
 * @fileOverview Schemas and types for the generateAssessmentQuestion flow.
 */
import { z } from 'zod'; // Use standard Zod

// --- Difficulty Levels ---
export const DifficultyLevelSchema = z.enum(['beginner', 'intermediate', 'advanced', 'expert']);
export type DifficultyLevel = z.infer<typeof DifficultyLevelSchema>;

// --- Input Schema and Type ---
export const GenerateAssessmentQuestionInputSchema = z.object({
  primarySkill: z.string().describe('Primary skill being assessed.'),
  allSkills: z.array(z.string()).describe('All skills claimed by the freelancer (for context).'),
  difficulty: DifficultyLevelSchema.describe('Target difficulty level of the question.'),
  previousQuestions: z.array(z.string()).optional().describe('Optional list of previously asked questions to avoid duplication.'),
  freelancerId: z.string().describe('Unique ID of the freelancer (for context and uniqueness).'),
  // Note: timestamp for ID generation handled internally, not passed from client
});
export type GenerateAssessmentQuestionInput = z.infer<typeof GenerateAssessmentQuestionInputSchema>;

// --- Output Schema and Type ---
export const GenerateAssessmentQuestionOutputSchema = z.object({
  questionId: z.string().describe('Unique identifier for the generated question (system-generated).'),
  questionText: z.string().describe('The actual assessment question text.'),
  skillTested: z.string().describe('The skill targeted by this question (must match primarySkill).'),
  difficulty: DifficultyLevelSchema.describe('Difficulty level of the question.'),
  // Future-proofing fields could include:
  // questionType: 'multiple-choice' | 'short-answer' | 'coding' (optional)
  // expectedKeywords: string[] (optional)
});
export type GenerateAssessmentQuestionOutput = z.infer<typeof GenerateAssessmentQuestionOutputSchema>;
