
/**
 * @fileOverview Schemas and types for the generateAssessmentQuestion flow.
 */
import { z } from 'zod'; // Use standard Zod

// Define difficulty levels Enum using Zod
export const DifficultyLevelSchema = z.enum(['beginner', 'intermediate', 'advanced', 'expert']);
export type DifficultyLevel = z.infer<typeof DifficultyLevelSchema>;

// Input type for the generateAssessmentQuestion function
export const GenerateAssessmentQuestionInputSchema = z.object({
  primarySkill: z.string().describe('The main skill being assessed.'),
  allSkills: z.array(z.string()).describe('All skills the freelancer claims to have, for context.'),
  difficulty: DifficultyLevelSchema.describe('The target difficulty level for the question.'),
  previousQuestions: z.array(z.string()).optional().describe('Optional list of previously asked questions to avoid repetition.'),
  freelancerId: z.string().describe('The ID of the freelancer being assessed (for context).'),
  // timestamp is added internally
});
export type GenerateAssessmentQuestionInput = z.infer<typeof GenerateAssessmentQuestionInputSchema>;

// Output type for the generateAssessmentQuestion function
// This defines the structure the AI is expected to return as JSON
export const GenerateAssessmentQuestionOutputSchema = z.object({
    questionId: z.string().describe("A unique identifier for this question (will be generated)."),
    questionText: z.string().describe("The text of the assessment question."),
    skillTested: z.string().describe("The specific skill this question is designed to test (should match primarySkill)."),
    difficulty: DifficultyLevelSchema.describe('The difficulty level of the generated question.'),
    // Potential future additions: questionType (e.g., 'multiple-choice', 'coding', 'free-text'), options, expectedAnswerKeywords
});
export type GenerateAssessmentQuestionOutput = z.infer<typeof GenerateAssessmentQuestionOutputSchema>;
