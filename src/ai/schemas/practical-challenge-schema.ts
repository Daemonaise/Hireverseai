import { z } from 'zod';

export const PracticalChallengeInputSchema = z.object({
  freelancerId: z.string(),
  primarySkill: z.string(),
  allSkills: z.array(z.string()),
  skillScoresSoFar: z.record(z.number()).describe('Scores from Phase 1 to calibrate difficulty'),
});

export const PracticalChallengeOutputSchema = z.object({
  challengeId: z.string(),
  challengeText: z.string().describe('The full practical challenge with scenario, constraints, and deliverable request'),
  expectedDeliverableType: z.string().describe('What kind of answer is expected: code, design_rationale, writing_sample, strategy'),
  estimatedMinutes: z.number().describe('Estimated time to complete (5-10 min)'),
});

export type PracticalChallengeInput = z.infer<typeof PracticalChallengeInputSchema>;
export type PracticalChallengeOutput = z.infer<typeof PracticalChallengeOutputSchema>;
