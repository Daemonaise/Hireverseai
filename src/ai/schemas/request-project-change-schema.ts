
/**
 * @fileOverview Schemas and types for the requestProjectChange flow.
 */
import { z } from 'zod'; // Use standard Zod

// Input type for the estimateProjectChangeImpact function
export const RequestProjectChangeInputSchema = z.object({
  projectId: z.string().describe('The unique identifier of the project being changed.'),
  currentBrief: z.string().describe('The original project brief.'),
  currentSkills: z.array(z.string()).describe('The skills originally required for the project.'),
  currentTimeline: z.string().describe('The current estimated timeline or completion date string.'),
  currentCost: z.number().describe('The current estimated cost of the project.'),
  changeDescription: z.string().describe('The client\'s description of the requested change.'),
  priority: z.enum(['Normal', 'High']).describe('The priority level of the change request.'),
});
export type RequestProjectChangeInput = z.infer<typeof RequestProjectChangeInputSchema>;

// Output type for the estimateProjectChangeImpact function
// This defines the structure the AI is expected to return as JSON
export const RequestProjectChangeOutputSchema = z.object({
  estimatedNewTimeline: z.string().describe('The new estimated project delivery timeline incorporating the change (e.g., "approx. 3 additional days", "New target: YYYY-MM-DD").'),
  // Ensure cost is non-negative
  estimatedAdditionalCost: z.number().nonnegative({ message: "Estimated additional cost cannot be negative."}).describe('The estimated additional cost in USD required for the change. Can be 0 if no cost impact.'),
  impactAnalysis: z.string().describe('A brief analysis explaining the reasoning behind the new timeline and cost estimates based on the requested change.'),
});
export type RequestProjectChangeOutput = z.infer<typeof RequestProjectChangeOutputSchema>;
