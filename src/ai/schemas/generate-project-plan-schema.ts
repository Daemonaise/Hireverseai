import { z } from 'zod';

const CertLevelSchema = z.enum(['beginner', 'intermediate', 'advanced', 'expert', 'master']);

const PlanTaskSchema = z.object({
  id: z.string(),
  description: z.string().min(10),
  role: z.string(),
  requiredSkill: z.string(),
  minCertificationLevel: CertLevelSchema,
  estimatedHours: z.number().min(0.5),
  dependencies: z.array(z.string()),
  parallelGroup: z.string(),
});

const PlanMilestoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  order: z.number().int(),
  dependencies: z.array(z.string()),
  qaGateEnabled: z.boolean(),
  tasks: z.array(PlanTaskSchema),
});

export const GenerateProjectPlanInputSchema = z.object({
  projectId: z.string(),
  brief: z.string(),
  projectTypes: z.array(z.string()),
  requiredRoles: z.array(z.string()),
  complexity: z.enum(['simple', 'moderate', 'complex']),
  estimatedTotalHours: z.number(),
  suggestedMilestoneCount: z.number(),
  clientPriority: z.enum(['speed', 'quality', 'budget']),
});

export const GenerateProjectPlanOutputSchema = z.object({
  milestones: z.array(PlanMilestoneSchema),
});

export type GenerateProjectPlanInput = z.infer<typeof GenerateProjectPlanInputSchema>;
export type GenerateProjectPlanOutput = z.infer<typeof GenerateProjectPlanOutputSchema>;
export type PlanTask = z.infer<typeof PlanTaskSchema>;
export type PlanMilestone = z.infer<typeof PlanMilestoneSchema>;
