import { z } from 'zod';

export const DifficultyLevelSchema = z.enum(['beginner', 'intermediate', 'advanced', 'expert', 'master']);

export const SkillQuestionInputSchema = z.object({
  freelancerId: z.string(),
  skills: z.array(z.string()).describe('All declared skills for the freelancer'),
  targetSkill: z.string().describe('The specific skill to test this question'),
  difficulty: DifficultyLevelSchema,
  previousQuestions: z.array(z.string()).optional().describe('Previously asked questions to avoid duplication'),
  sessionSeed: z.string().describe('Unique session seed for question uniqueness'),
});

export const SkillQuestionOutputSchema = z.object({
  questionId: z.string(),
  questionText: z.string().describe('The complete question with any code snippets, data, or scenarios inline'),
  skillTested: z.string(),
  difficulty: DifficultyLevelSchema,
  questionCategory: z.string().describe('Category like "code_debug", "design_critique", "strategy", etc.'),
});

export type SkillQuestionInput = z.infer<typeof SkillQuestionInputSchema>;
export type SkillQuestionOutput = z.infer<typeof SkillQuestionOutputSchema>;
