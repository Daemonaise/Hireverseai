

/**
 * @fileOverview Schemas and types for the matchFreelancer flow.
 */
import { z } from 'genkit';

export const MatchFreelancerInputSchema = z.object({
  projectId: z.string().optional().describe('Optional: The unique identifier for an existing project if rematching or associating.'),
  projectBrief: z.string().min(20).describe('A plain-language description of the project requirements (min 20 chars).'),
  // requiredSkills is now optional as it can be extracted by the flow
  requiredSkills: z.array(z.string()).optional().describe('Optional: List of essential skills for the project. If empty or omitted, skills will be extracted from the brief.'),
  // Clarify freelancerId purpose - context for user-specific model, not necessarily the client ID
  freelancerId: z.string().optional().describe("Optional: ID of the user (can be freelancer or client) requesting the match, used to check for personalized AI models."),
});
export type MatchFreelancerInput = z.infer<typeof MatchFreelancerInputSchema>;

export const MatchFreelancerOutputSchema = z.object({
  matchedFreelancerId: z.string().optional().describe('The ID of the best-fit available freelancer assigned, if any.'),
  reasoning: z.string().describe('Explanation of the matching decision, estimation rationale, or why no match was found.'),
  estimatedBaseCost: z.number().positive().optional().describe('Estimated cost paid to the freelancer in USD (excluding platform fee).'),
  platformFee: z.number().nonnegative().optional().describe('Calculated platform fee (e.g., 15% markup) in USD.'),
  totalCostToClient: z.number().positive().optional().describe('Total estimated project cost for the client (Base Cost + Platform Fee) in USD.'),
  estimatedTimeline: z.string().optional().describe('Estimated project delivery timeline (e.g., "2-3 days", "1 week").'),
  // Ensure estimatedHours is slightly greater than 0 if present
  estimatedHours: z.number().min(0.1, { message: "Estimated hours must be greater than 0." }).optional().describe('Estimated total hours required for the project (must be > 0).'),
  extractedSkills: z.array(z.string()).optional().describe('Skills extracted from the project brief if none were provided explicitly.'),
  // Updated status enum for clarity
  status: z.enum(['matched', 'no_available_freelancer', 'estimation_only', 'error']).describe(
    `Outcome:
    - matched: Found suitable freelancer and estimated scope.
    - no_available_freelancer: Estimated scope, but no suitable freelancer online/available.
    - estimation_only: Provided estimate but no freelancers were checked (e.g., initial estimate phase).
    - error: An error occurred during the process.`
  ),
});
export type MatchFreelancerOutput = z.infer<typeof MatchFreelancerOutputSchema>;


