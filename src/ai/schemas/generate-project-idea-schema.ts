/**
 * @fileOverview Schemas and types for the generateProjectIdea flow.
 */
import { z } from 'zod'; // Standard Zod import

// --- Input schema ---
export const GenerateProjectIdeaInputSchema = z.object({
  industryHint: z.string().optional().describe("Optional hint about the desired industry or project focus."),
});
export type GenerateProjectIdeaInput = z.infer<typeof GenerateProjectIdeaInputSchema>;

// --- Raw AI output schema (before cost calculations) ---
export const GenerateProjectIdeaAIOutputSchema = z.object({
  idea: z.string().min(5).describe('Concise, actionable freelance project idea. Should be creative and feasible.'),
  details: z.string().optional().describe('Optional 1–2 sentence elaboration on the idea.'),
  estimatedTimeline: z.string().min(3).describe('Realistic delivery timeline (e.g., "3-5 days", "1-2 weeks").'),
  estimatedHours: z.number().positive({ message: "Estimated hours must be greater than 0." }).describe('Estimated total hours needed (positive value).'),
  requiredSkills: z.array(z.string()).min(1).max(5).optional().describe('Key skills needed for execution.'),
});
export type GenerateProjectIdeaAIOutput = z.infer<typeof GenerateProjectIdeaAIOutputSchema>;

// --- Final Output schema (AI output + costs) ---
export const GenerateProjectIdeaOutputSchema = z.object({
  idea: z.string().describe('Short project idea title or summary.'),
  details: z.string().optional().describe('Optional details expanding the idea.'),
  estimatedTimeline: z.string().describe('Estimated project timeline for completion.'),
  estimatedHours: z.number().positive().optional().describe('Positive estimated work hours required.'),
  estimatedBaseCost: z.number().nonnegative().optional().describe('Freelancer base payout (USD).'),
  platformFee: z.number().nonnegative().optional().describe('Platform fee (typically a 15% markup).'),
  totalCostToClient: z.number().nonnegative().optional().describe('Total estimated project cost for the client.'),
  monthlySubscriptionCost: z.number().positive().optional().describe('Estimated monthly subscription cost (if applicable).'),
  reasoning: z.string().optional().describe('Optional AI-generated brief reasoning for the idea and estimates.'),
  status: z.enum(['success', 'error']).describe('Whether generation succeeded or failed.'),
  requiredSkills: z.array(z.string()).optional().describe('Skills identified as required for project success.'),
});
export type GenerateProjectIdeaOutput = z.infer<typeof GenerateProjectIdeaOutputSchema>;
