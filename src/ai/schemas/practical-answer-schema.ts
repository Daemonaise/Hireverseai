import { z } from 'zod';

export const PracticalAnswerInputSchema = z.object({
  freelancerId: z.string(),
  challengeId: z.string(),
  challengeText: z.string(),
  primarySkill: z.string(),
  answerText: z.string(),
  timeSpentSeconds: z.number(),
});

export const PracticalAnswerOutputSchema = z.object({
  challengeId: z.string(),
  score: z.number().int().min(0).max(100),
  feedback: z.string().describe('Detailed feedback on quality, creativity, completeness, and practical applicability'),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
});

export type PracticalAnswerInput = z.infer<typeof PracticalAnswerInputSchema>;
export type PracticalAnswerOutput = z.infer<typeof PracticalAnswerOutputSchema>;
