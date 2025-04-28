
/**
 * @fileOverview Schemas and types for the generateProjectIdea flow.
 */
import { z } from 'zod'; // Use standard Zod

// Input type for the generateProjectIdea function
export const GenerateProjectIdeaInputSchema = z.object({
  industryHint: z.string().optional().describe("Optional hint about the desired industry or type of project."),
});
export type GenerateProjectIdeaInput = z.infer<typeof GenerateProjectIdeaInputSchema>;

// Schema for the expected JSON output from the AI model
export const GenerateProjectIdeaAIOutputSchema = z.object({
  idea: z.string().describe('Suggest a concise and actionable project idea suitable for freelance execution. Be creative!'),
  details: z.string().optional().describe('Provide 1-2 sentences elaborating on the suggested project idea.'),
  estimatedTimeline: z.string().describe('Estimate a realistic project delivery timeline (e.g., "3-5 days", "1-2 weeks").'),
  // Ensure estimatedHours is strictly positive
  estimatedHours: z.number().positive({ message: "Estimated hours must be greater than 0." }).describe('Estimate the total number of hours required (fair US market standard). Must be greater than 0.'),
  requiredSkills: z.array(z.string()).optional().describe('List 1-3 key skills potentially needed.'),
});
export type GenerateProjectIdeaAIOutput = z.infer<typeof GenerateProjectIdeaAIOutputSchema>;


// Output type for the final generateProjectIdea function (includes calculated costs)
export const GenerateProjectIdeaOutputSchema = z.object({
  idea: z.string().describe('The suggested project idea title or brief summary.'),
  details: z.string().optional().describe('Further details or elaboration on the project idea.'),
  estimatedTimeline: z.string().describe('Estimated project delivery timeline (e.g., "3-5 days", "1-2 weeks").'),
  // estimatedHours can be undefined if AI fails
  estimatedHours: z.number().positive().optional().describe('Estimated total hours required for the project (must be > 0).'),
  // Costs calculated after AI generation, can be undefined if AI fails
  estimatedBaseCost: z.number().nonnegative().optional().describe('Estimated cost paid to the freelancer.'),
  platformFee: z.number().nonnegative().optional().describe('Calculated platform fee (15% markup).'),
  totalCostToClient: z.number().nonnegative().optional().describe('Total estimated project cost for the client.'),
  monthlySubscriptionCost: z.number().positive().optional().describe('Fixed monthly subscription cost for the client.'),
  reasoning: z.string().optional().describe('Brief explanation of the estimates or idea generation process/outcome.'),
  status: z.enum(['success', 'error']).describe('Indicates if the generation was successful.'),
  requiredSkills: z.array(z.string()).optional().describe('Skills identified by the AI.'),
});
export type GenerateProjectIdeaOutput = z.infer<typeof GenerateProjectIdeaOutputSchema>;
