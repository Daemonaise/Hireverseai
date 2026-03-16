import { z } from 'zod';

export const WorkspaceBriefingInputSchema = z.object({
  workspaceId: z.string(),
  freelancerId: z.string(),
  periodStart: z.string().describe('ISO date string for period start'),
  periodEnd: z.string().describe('ISO date string for period end'),
});

export const WorkspaceBriefingOutputSchema = z.object({
  summary: z.string().describe('A comprehensive summary paragraph of workspace activity'),
  actionItems: z.array(z.string()).describe('Prioritized action items sorted by urgency'),
  blockers: z.array(z.string()).describe('Identified blockers or risks'),
});

export type WorkspaceBriefingInput = z.infer<typeof WorkspaceBriefingInputSchema>;
export type WorkspaceBriefingOutput = z.infer<typeof WorkspaceBriefingOutputSchema>;
