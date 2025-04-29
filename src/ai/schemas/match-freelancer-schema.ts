
/**
 * @fileOverview Schemas and types for the matchFreelancer AI flow.
 */

import { z } from 'zod';

// --- Input Schema for matchFreelancer ---
export const MatchFreelancerInputSchema = z.object({
  projectId: z.string().optional().describe('Optional: Existing project ID for rematch or association.'),
  projectBrief: z.string().min(20).describe('A plain-language description of the project requirements (min 20 characters).'),
  requiredSkills: z.array(z.string()).optional().describe('Optional: List of required skills. If omitted, AI will extract skills.'),
  freelancerId: z.string().optional().describe('Optional: ID of the requesting freelancer or client. Used for user-specific context if needed.'),
});
export type MatchFreelancerInput = z.infer<typeof MatchFreelancerInputSchema>;

// --- Skill Extraction AI Output Schema ---
export const ExtractSkillsAIOutputSchema = z.object({
  extractedSkills: z.array(z.string()).min(1).max(5).describe('List of 1-5 key skills extracted from project brief.'),
});
export type ExtractSkillsAIOutput = z.infer<typeof ExtractSkillsAIOutputSchema>;

// --- Estimation and Freelancer Selection AI Output Schema ---
export const EstimateAndSelectAIOutputSchema = z.object({
  selectedFreelancerId: z.string().optional().nullable().describe('ID of selected freelancer, or null if none matched.'),
  reasoning: z.string().describe('Justification for the selection or no selection.'),
  estimatedHours: z.number().positive().describe('Estimated hours required to complete the project (must be greater than 0).'),
  estimatedTimeline: z.string().describe('Estimated project delivery timeline (e.g., "3-5 days", "1 week").'),
});
export type EstimateAndSelectAIOutput = z.infer<typeof EstimateAndSelectAIOutputSchema>;

// --- Final Output Schema for matchFreelancer ---
export const MatchFreelancerOutputSchema = z.object({
  matchedFreelancerId: z.string().optional().describe('ID of the matched freelancer, if any.'),
  reasoning: z.string().describe('Explanation for the match or estimation outcome.'),
  estimatedBaseCost: z.number().nonnegative().optional().describe('Base cost estimate paid to the freelancer.'),
  platformFee: z.number().nonnegative().optional().describe('Calculated platform fee (markup).'),
  totalCostToClient: z.number().nonnegative().optional().describe('Total project cost to client including markup.'),
  estimatedTimeline: z.string().optional().describe('Projected project completion timeline.'),
  estimatedHours: z.number().positive().optional().describe('Estimated hours required for project.'),
  extractedSkills: z.array(z.string()).optional().describe('Skills extracted from project brief if none were provided.'),
  status: z.enum(['matched', 'no_available_freelancer', 'estimation_only', 'error']).describe(`
Result:
- matched: Suitable freelancer matched and project estimated.
- no_available_freelancer: Estimated project but no freelancer matched.
- estimation_only: Estimate provided without checking freelancers.
- error: An error occurred during matching process.
`),
});
export type MatchFreelancerOutput = z.infer<typeof MatchFreelancerOutputSchema>;
