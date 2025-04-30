
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
// All fields are now strictly required as per the prompt instructions.
export const GenerateProjectIdeaAIOutputSchema = z.object({
  idea: z.string().min(1, 'Idea cannot be empty.'), // Must be non-empty
  details: z.string().min(1, 'Details cannot be empty.'), // Must be non-empty
  estimatedTimeline: z.string().min(1, 'Timeline cannot be empty.'), // Must be non-empty
  // Use .positive() instead of exclusiveMinimum(0) for Gemini compatibility
  estimatedHours: z.number().int().positive('Estimated hours must be a positive integer.'), // Must be > 0
  requiredSkills: z.array(z.string().min(1)).min(1, "At least one skill is required.").max(5, "Maximum of 5 skills allowed."), // Must have 1-5 skills
});
export type GenerateProjectIdeaAIOutput = z.infer<typeof GenerateProjectIdeaAIOutputSchema>;

// --- Final Output Schema (after cost calculations) ---
// Ensure 'status' is always present. Cost fields are optional as they depend on calculation success.
export const GenerateProjectIdeaOutputSchema = z.object({
  idea: z.string().describe('Short project idea title.').default('Error'), // Default on error
  details: z.string().optional().describe('Optional detailed description of the idea.'),
  estimatedTimeline: z.string().describe('Expected delivery timeline for the project.').default('N/A'), // Default on error
  estimatedHours: z.number().positive().optional().describe('Positive total estimated hours.'),
  estimatedBaseCost: z.number().nonnegative().optional().describe('Freelancer base payout in USD.'),
  platformFee: z.number().nonnegative().optional().describe('Added platform fee (USD).'),
  totalCostToClient: z.number().nonnegative().optional().describe('Total cost to the client (USD).'),
  monthlySubscriptionCost: z.number().nonnegative().optional().describe('Estimated monthly subscription cost (USD, if used). Allow 0.'),
  reasoning: z.string().optional().describe('Brief explanation of calculation or error.'),
  status: z.enum(['success', 'error']).describe('Whether idea generation succeeded or failed.'), // No default, should always be set
  requiredSkills: z.array(z.string()).optional().describe('Skills needed for project success.'),
});
export type GenerateProjectIdeaOutput = z.infer<typeof GenerateProjectIdeaOutputSchema>;
