import { z } from 'zod';

export const ServiceCategorySchema = z.enum([
  'programming', 'design', 'writing', 'marketing',
  'video', 'music', 'business', 'translation', 'ai_data',
]);

export const ClientPrioritySchema = z.enum(['speed', 'quality', 'budget']);

export const AnalyzeProjectInputSchema = z.object({
  projectId: z.string(),
  brief: z.string().min(20),
  category: ServiceCategorySchema,
  clientPriority: ClientPrioritySchema,
});

export const AnalyzeProjectOutputSchema = z.object({
  projectTypes: z.array(ServiceCategorySchema).describe('Categories this project spans'),
  requiredRoles: z.array(z.string()).describe('Roles needed, e.g., frontend_developer, ui_designer'),
  complexity: z.enum(['simple', 'moderate', 'complex']),
  estimatedTotalHours: z.number(),
  suggestedMilestoneCount: z.number().int().min(1).max(10),
});

export type AnalyzeProjectInput = z.infer<typeof AnalyzeProjectInputSchema>;
export type AnalyzeProjectOutput = z.infer<typeof AnalyzeProjectOutputSchema>;
