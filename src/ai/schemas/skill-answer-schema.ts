import { z } from 'zod';
import { DifficultyLevelSchema } from './skill-question-schema';

export const AnswerFlagSchema = z.enum([
  'ai_generated_suspected',
  'plagiarized_suspected',
  'irrelevant',
  'too_short',
  'profane',
  'timing_anomaly',
  'cadence_anomaly',
  'consistency_check',
]);

export const SkillAnswerInputSchema = z.object({
  freelancerId: z.string(),
  questionId: z.string(),
  questionText: z.string(),
  skillTested: z.string(),
  difficulty: DifficultyLevelSchema,
  answerText: z.string(),
  timeSpentSeconds: z.number().describe('How long the freelancer took to answer'),
});

export const SkillAnswerOutputSchema = z.object({
  questionId: z.string(),
  score: z.number().int().min(0).max(100),
  feedback: z.string().describe('Specific feedback on strengths and weaknesses'),
  flags: z.array(AnswerFlagSchema).optional(),
  suggestedNextDifficulty: z.enum(['easier', 'same', 'harder']),
});

export type SkillAnswerInput = z.infer<typeof SkillAnswerInputSchema>;
export type SkillAnswerOutput = z.infer<typeof SkillAnswerOutputSchema>;
