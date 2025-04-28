
/**
 * @fileOverview Schemas and types for the matchFreelancer flow.
 */
import { z } from 'zod'; // Use standard Zod

// --- Input Schema for the main matchFreelancer function ---
export const MatchFreelancerInputSchema = z.object({
  projectId: z.string().optional().describe('Optional: The unique identifier for an existing project if rematching or associating.'),
  projectBrief: z.string().min(20).describe('A plain-language description of the project requirements (min 20 chars).'),
  // requiredSkills is now optional as it can be extracted by the flow
  requiredSkills: z.array(z.string()).optional().describe('Optional: List of essential skills for the project. If empty or omitted, skills will be extracted from the brief.'),
  // Clarify freelancerId purpose - context for user-specific model, not necessarily the client ID
  freelancerId: z.string().optional().describe("Optional: ID of the user (can be freelancer or client) requesting the match, used to check for personalized AI models."),
});
export type MatchFreelancerInput = z.infer<typeof MatchFreelancerInputSchema>;


// --- Schema for AI Skill Extraction Output ---
export const ExtractSkillsAIOutputSchema = z.object({
  extractedSkills: z.array(z.string()).min(1, {message: "Must extract at least one skill."}).max(5).describe("List of 1 to 5 key skills.")
});
export type ExtractSkillsAIOutput = z.infer<typeof ExtractSkillsAIOutputSchema>;


// --- Schema for AI Estimation and Selection Output ---
export const EstimateAndSelectAIOutputSchema = z.object({
    selectedFreelancerId: z.string().optional().nullable().describe('The ID of the chosen freelancer, or empty/null if none are suitable/available.'), // Allow null
    reasoning: z.string().describe('Justification for selecting this freelancer, or why none were chosen. Include estimation rationale.'),
    // Ensure schema here matches DecomposeProjectSchema's minimum requirement
    estimatedHours: z.number().positive({ message: "Estimated hours must be greater than 0." }).describe('Estimated total hours required for the project (realistic US market standard, must be greater than 0).'),
    estimatedTimeline: z.string().describe('Estimated project delivery timeline (e.g., "2-3 days", "1 week").'),
});
export type EstimateAndSelectAIOutput = z.infer<typeof EstimateAndSelectAIOutputSchema>;


// --- Final Output Schema for the matchFreelancer function ---
export const MatchFreelancerOutputSchema = z.object({
  matchedFreelancerId: z.string().optional().describe('The ID of the best-fit available freelancer assigned, if any.'),
  reasoning: z.string().describe('Explanation of the matching decision, estimation rationale, or why no match was found.'),
  estimatedBaseCost: z.number().nonnegative().optional().describe('Estimated cost paid to the freelancer in USD (excluding platform fee).'),
  platformFee: z.number().nonnegative().optional().describe('Calculated platform fee (e.g., 15% markup) in USD.'),
  totalCostToClient: z.number().nonnegative().optional().describe('Total estimated project cost for the client (Base Cost + Platform Fee) in USD.'),
  estimatedTimeline: z.string().optional().describe('Estimated project delivery timeline (e.g., "2-3 days", "1 week").'),
  // Ensure estimatedHours is positive if present
  estimatedHours: z.number().positive().optional().describe('Estimated total hours required for the project (must be > 0).'),
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
