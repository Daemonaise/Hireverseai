import { z } from 'zod';

export const WorkspaceQAReviewInputSchema = z.object({
  workspaceId: z.string(),
  freelancerId: z.string(),
  projectId: z.string(),
  submittedWork: z.string().describe('URL or text of submitted work'),
  projectBrief: z.string(),
  microtasks: z.array(z.object({
    description: z.string(),
    requiredSkill: z.string(),
  })),
});

export const WorkspaceQAReviewOutputSchema = z.object({
  passed: z.boolean(),
  score: z.number().min(0).max(100),
  feedback: z.string(),
  issues: z.array(z.object({
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    description: z.string(),
    suggestion: z.string(),
  })),
});

export type WorkspaceQAReviewInput = z.infer<typeof WorkspaceQAReviewInputSchema>;
export type WorkspaceQAReviewOutput = z.infer<typeof WorkspaceQAReviewOutputSchema>;
