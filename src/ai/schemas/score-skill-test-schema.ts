/**
 * @fileOverview Schemas and types for the scoreSkillTest flow.
 */
import { z } from 'genkit';

export const AnswerSchema = z.object({
    questionText: z.string().describe("The original question text."),
    skillTested: z.string().describe("The skill the question was testing."),
    answerText: z.string().describe("The freelancer's submitted answer."),
});
export type Answer = z.infer<typeof AnswerSchema>;

export const ScoreSkillTestInputSchema = z.object({
  freelancerId: z.string().describe('The unique identifier for the freelancer.'),
  testId: z.string().describe("The unique identifier for the test instance being scored."),
  answers: z.array(AnswerSchema).min(1).describe("The list of answers submitted by the freelancer."),
});
export type ScoreSkillTestInput = z.infer<typeof ScoreSkillTestInputSchema>;

export const SkillScoreSchema = z.object({
    skill: z.string().describe("The skill being scored."),
    score: z.number().int().min(0).max(100).describe("The calculated score for the skill (0-100)."),
    reasoning: z.string().describe("The AI's justification for the assigned score, explaining strengths and weaknesses."),
});
export type SkillScore = z.infer<typeof SkillScoreSchema>;

export const ScoreSkillTestOutputSchema = z.object({
  overallScore: z.number().int().min(0).max(100).describe("An overall score for the test (0-100, average of skill scores)."),
  skillScores: z.array(SkillScoreSchema).describe("Scores broken down by individual skill."),
  feedback: z.string().optional().describe("Concise, overall qualitative feedback for the freelancer, summarizing performance."),
});
export type ScoreSkillTestOutput = z.infer<typeof ScoreSkillTestOutputSchema>;
