

/**
 * @fileOverview Schemas and types for the generateProjectIdea flow.
 */
import { z } from 'genkit';

export const GenerateProjectIdeaInputSchema = z.object({
  // Currently no specific inputs needed, but can be added (e.g., desired field)
  industryHint: z.string().optional().describe("Optional hint about the desired industry or type of project."),
});
export type GenerateProjectIdeaInput = z.infer<typeof GenerateProjectIdeaInputSchema>;

export const GenerateProjectIdeaOutputSchema = z.object({
  idea: z.string().describe('The suggested project idea title or brief summary.'),
  details: z.string().optional().describe('Further details or elaboration on the project idea.'),
  estimatedTimeline: z.string().describe('Estimated project delivery timeline (e.g., "3-5 days", "1-2 weeks").'),
  // Ensure estimatedHours is slightly greater than 0 if present
  estimatedHours: z.number().min(0.1, { message: "Estimated hours must be greater than 0." }).describe('Estimated total hours required for the project (must be > 0).'),
  // Costs calculated after AI generation
  estimatedBaseCost: z.number().min(0).optional().describe('Estimated cost paid to the freelancer.'), // Can be 0 if hours estimate fails
  platformFee: z.number().nonnegative().optional().describe('Calculated platform fee (15% markup).'),
  totalCostToClient: z.number().min(0).optional().describe('Total estimated project cost for the client.'), // Can be 0 if hours estimate fails
  monthlySubscriptionCost: z.number().positive().optional().describe('Fixed monthly subscription cost for the client.'),
  reasoning: z.string().optional().describe('Brief explanation of the estimates or idea generation.'),
  status: z.enum(['success', 'error']).describe('Indicates if the generation was successful.')
});
export type GenerateProjectIdeaOutput = z.infer<typeof GenerateProjectIdeaOutputSchema>;


