// src/ai/schemas/generate-project-idea-schema.ts
import { z } from 'zod';

export const GenerateProjectIdeaInputSchema = z.object({
  industryHint: z.string().optional(),
});
export type GenerateProjectIdeaInput = z.infer<typeof GenerateProjectIdeaInputSchema>;

export const GenerateProjectIdeaAIOutputSchema = z.object({
  idea:              z.string().min(1),
  details:           z.string().min(1),
  estimatedTimeline: z.string().min(1),
  estimatedHours:    z.number().min(1, 'Estimated hours must be at least 1'), // Changed from .int().min(1) to .number().min(1)
  requiredSkills:    z.array(z.string().min(1)).min(1).max(5),
});
export type GenerateProjectIdeaAIOutput = z.infer<typeof GenerateProjectIdeaAIOutputSchema>;

export const GenerateProjectIdeaOutputSchema = z.object({
  idea:                     z.string().default('Error'),
  details:                  z.string().optional(),
  estimatedTimeline:        z.string().default('N/A'),
  estimatedHours:           z.number().optional(),
  estimatedBaseCost:        z.number().min(0).optional(),
  platformFee:              z.number().min(0).optional(),
  totalCostToClient:        z.number().min(0).optional(),
  monthlySubscriptionCost:  z.number().min(0).optional(),
  reasoning:                z.string().optional(),
  status:                   z.enum(['success','error']),
  requiredSkills:           z.array(z.string()).optional(),
});
export type GenerateProjectIdeaOutput = z.infer<typeof GenerateProjectIdeaOutputSchema>;

