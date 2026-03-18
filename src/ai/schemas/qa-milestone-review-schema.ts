import { z } from 'zod';

export const QaMilestoneReviewInputSchema = z.object({
  projectId: z.string(),
  milestoneId: z.string(),
  milestoneName: z.string(),
  projectBrief: z.string(),
  completedTasks: z.array(z.object({
    taskId: z.string(),
    description: z.string(),
    role: z.string(),
    submittedWork: z.string().describe('The deliverable or work URL'),
    freelancerCertLevel: z.string(),
  })),
});

export const QaMilestoneReviewOutputSchema = z.object({
  milestoneId: z.string(),
  passed: z.boolean(),
  score: z.number().int().min(0).max(100),
  feedback: z.string(),
  taskReviews: z.array(z.object({
    taskId: z.string(),
    score: z.number().int().min(0).max(100),
    feedback: z.string(),
    revisionNeeded: z.boolean(),
  })),
});

export type QaMilestoneReviewInput = z.infer<typeof QaMilestoneReviewInputSchema>;
export type QaMilestoneReviewOutput = z.infer<typeof QaMilestoneReviewOutputSchema>;
