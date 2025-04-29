/**
 * @fileOverview Schemas and types for the generateProjectIdea flow.
 */
import { z } from 'zod';

// --- Input Schema ---
export const GenerateProjectIdeaInputSchema = z.object({
  industryHint: z.string().optional().describe('Optional hint for industry or focus area.'),
});
export type GenerateProjectIdeaInput = z.infer<typeof GenerateProjectIdeaInputSchema>;

// --- Raw AI Output Schema (pre-cost calculation) ---
export const GenerateProjectIdeaAIOutputSchema = z.object({
  idea: z.string().min(5, 'Idea must be at least 5 characters long.').describe('Concise, feasible freelance project idea.'),
  details: z.string().optional().describe('Optional elaboration (1–2 sentences about the project).'),
  estimatedTimeline: z.string().min(3, 'Timeline must be at least 3 characters.').describe('Example: "3-5 days", "1-2 weeks".'),
  estimatedHours: z.number().positive('Estimated hours must be a positive number.').describe('Positive total number of hours required.'),
  requiredSkills: z.array(z.string()).min(1).max(5).optional().describe('List of required skills (up to 5).'),
});
export type GenerateProjectIdeaAIOutput = z.infer<typeof GenerateProjectIdeaAIOutputSchema>;

// --- Final Output Schema (after cost calculations) ---
export const GenerateProjectIdeaOutputSchema = z.object({
  idea: z.string().describe('Short project idea title.'),
  details: z.string().optional().describe('Optional detailed description of the idea.'),
  estimatedTimeline: z.string().describe('Expected delivery timeline for the project.'),
  estimatedHours: z.number().positive().optional().describe('Positive total estimated hours (optional at final stage).'),
  estimatedBaseCost: z.number().nonnegative().optional().describe('Freelancer base payout in USD.'),
  platformFee: z.number().nonnegative().optional().describe('Added platform fee (USD).'),
  totalCostToClient: z.number().nonnegative().optional().describe('Total cost to the client (USD).'),
  monthlySubscriptionCost: z.number().positive().optional().describe('Estimated monthly subscription cost (USD, if used).'),
  reasoning: z.string().optional().describe('Brief explanation of calculation assumptions.'),
  status: z.enum(['success', 'error']).describe('Whether idea generation succeeded or failed.'),
  requiredSkills: z.array(z.string()).optional().describe('Skills needed for project success.'),
});
export type GenerateProjectIdeaOutput = z.infer<typeof GenerateProjectIdeaOutputSchema>;
