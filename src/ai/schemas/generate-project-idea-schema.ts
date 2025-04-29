/**
 * @fileOverview Schemas and types for the generateProjectIdea flow.
 */
import { z } from 'zod';

// --- Input Schema ---
export const GenerateProjectIdeaInputSchema = z.object({
  industryHint: z.string().optional().describe('Optional hint for industry or focus area.'),
});
export type GenerateProjectIdeaInput = z.infer<typeof GenerateProjectIdeaInputSchema>;

// --- Raw AI Output Schema (for stricter validation of AI's JSON response) ---
export const GenerateProjectIdeaAIOutputSchema = z.object({
  idea: z.string().min(5, 'Idea must be at least 5 characters long.'),
  details: z.string().min(1, 'Details cannot be empty.'), // Changed from optional to required non-empty string
  estimatedTimeline: z.string().min(3, 'Timeline must be at least 3 characters.'),
  estimatedHours: z.number().int().positive('Estimated hours must be a positive integer.'), // Enforce integer
  requiredSkills: z.array(z.string().min(1)).min(1, "At least one skill is required.").max(5, "Maximum of 5 skills allowed."), // Made required, min 1, max 5
});
export type GenerateProjectIdeaAIOutput = z.infer<typeof GenerateProjectIdeaAIOutputSchema>;

// --- Final Output Schema (after cost calculations) ---
export const GenerateProjectIdeaOutputSchema = z.object({
  idea: z.string().describe('Short project idea title.'),
  details: z.string().optional().describe('Optional detailed description of the idea.'), // Keep optional here as it's derived
  estimatedTimeline: z.string().describe('Expected delivery timeline for the project.'),
  estimatedHours: z.number().positive().optional().describe('Positive total estimated hours (optional at final stage).'), // Keep optional here
  estimatedBaseCost: z.number().nonnegative().optional().describe('Freelancer base payout in USD.'),
  platformFee: z.number().nonnegative().optional().describe('Added platform fee (USD).'),
  totalCostToClient: z.number().nonnegative().optional().describe('Total cost to the client (USD).'),
  monthlySubscriptionCost: z.number().nonnegative().optional().describe('Estimated monthly subscription cost (USD, if used). Allow 0.'), // Allow 0 cost
  reasoning: z.string().optional().describe('Brief explanation of calculation assumptions.'),
  status: z.enum(['success', 'error']).describe('Whether idea generation succeeded or failed.'),
  requiredSkills: z.array(z.string()).optional().describe('Skills needed for project success.'), // Keep optional here
});
export type GenerateProjectIdeaOutput = z.infer<typeof GenerateProjectIdeaOutputSchema>;
