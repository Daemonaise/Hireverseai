
'use server';
/**
 * @fileOverview Generates a project idea with cost and timeline estimations.
 * Uses the default Google AI model.
 *
 * Exports:
 * - generateProjectIdea - A function that generates a project idea.
 */

import { ai } from '@/ai/ai-instance'; // Import the configured 'ai' instance
import { z } from 'genkit';
import {
    GenerateProjectIdeaInputSchema,
    type GenerateProjectIdeaInput,
    GenerateProjectIdeaOutputSchema,
    type GenerateProjectIdeaOutput,
} from '@/ai/schemas/generate-project-idea-schema';

// --- Constants ---
const PLATFORM_MARKUP_PERCENTAGE = 0.15; // 15%
const DEFAULT_HOURLY_RATE_USD = 50;
const TECH_HOURLY_RATE_USD = 70;
const DESIGN_HOURLY_RATE_USD = 60;
const WRITING_HOURLY_RATE_USD = 55;
const MONTHLY_SUBSCRIPTION_COST = 20; // Fixed monthly cost

// --- Helper Functions ---

/**
 * Calculates the estimated base cost based on hours and skills, reflecting fair US market rates.
 * @param hours Estimated hours for the project.
 * @param skills List of required skills (optional, used for rate adjustment).
 * @returns The estimated base cost in USD.
 */
function calculateEstimatedBaseCost(hours: number, skills?: string[]): number {
    let averageRate = DEFAULT_HOURLY_RATE_USD;
    if (skills && skills.length > 0) {
        const lowerCaseSkills = skills.map(s => s.toLowerCase());
        if (lowerCaseSkills.some(s => s.includes('develop') || s.includes('tech') || s.includes('code'))) {
            averageRate = TECH_HOURLY_RATE_USD;
        } else if (lowerCaseSkills.some(s => s.includes('design') || s.includes('graphic'))) {
            averageRate = DESIGN_HOURLY_RATE_USD;
        } else if (lowerCaseSkills.some(s => s.includes('writing') || s.includes('edit'))) {
            averageRate = WRITING_HOURLY_RATE_USD;
        }
    }
    const estimatedBaseCost = hours * averageRate;
    return Number(estimatedBaseCost.toFixed(2));
}


// --- Exported Flow Function ---

export async function generateProjectIdea(input: GenerateProjectIdeaInput): Promise<GenerateProjectIdeaOutput> {
  return generateProjectIdeaFlow(input);
}

// --- AI Prompt Definition ---

const ideaGenerationPrompt = ai.definePrompt({
  name: 'ideaGenerationPrompt',
  input: { schema: GenerateProjectIdeaInputSchema },
  // AI outputs core idea, hours, timeline. Costs calculated later.
  output: { schema: z.object({
      idea: z.string().describe('Suggest a concise and actionable project idea suitable for freelance execution. Be creative!'),
      details: z.string().optional().describe('Provide 1-2 sentences elaborating on the suggested project idea.'),
      estimatedTimeline: z.string().describe('Estimate a realistic project delivery timeline (e.g., "3-5 days", "1-2 weeks").'),
      // Ensure positive estimate slightly > 0
      estimatedHours: z.number().min(0.1, { message: "Estimated hours must be greater than 0." }).describe('Estimate the total number of hours required (fair US market standard). Must be greater than 0.'),
      requiredSkills: z.array(z.string()).optional().describe('List 1-3 key skills potentially needed.'),
  })},
  prompt: `Generate a creative and actionable project idea that could be completed by freelancers on a platform like Hireverse AI.
Consider typical freelance tasks like web design, writing, graphic design, development, etc.
{{#if industryHint}}Focus the idea around the following industry or type: {{{industryHint}}}{{/if}}

Provide:
1. A short, compelling project 'idea'.
2. Optional brief 'details' elaborating on the idea (1-2 sentences).
3. An estimated 'timeline' for completion (e.g., "2-3 days", "about 1 week").
4. An estimated number of 'hours' required (be realistic, e.g., 5-40 hours, MUST be greater than 0).
5. Optionally, list 1-3 key 'requiredSkills'.

Output ONLY the JSON object matching the specified output schema. Ensure 'estimatedHours' is a positive number greater than 0.`,
  config: {
      temperature: 0.8, // Higher temperature for more creative ideas
  },
   // Model defaults to the one configured in ai-instance.ts (gemini-2.0-flash)
});

// --- Main Flow Definition ---

const generateProjectIdeaFlow = ai.defineFlow<
  typeof GenerateProjectIdeaInputSchema,
  typeof GenerateProjectIdeaOutputSchema
>(
  {
    name: 'generateProjectIdeaFlow',
    inputSchema: GenerateProjectIdeaInputSchema,
    outputSchema: GenerateProjectIdeaOutputSchema,
  },
  async (input) => {
    // Define a fallback output that matches the schema
    const fallbackOutput: GenerateProjectIdeaOutput = {
        idea: "Error Generating Idea",
        estimatedTimeline: "N/A",
        estimatedHours: 0.1, // Use minimum valid value as placeholder
        reasoning: 'Failed to generate idea due to an error.',
        status: 'error',
        estimatedBaseCost: undefined,
        platformFee: undefined,
        totalCostToClient: undefined,
        monthlySubscriptionCost: undefined,
        details: undefined,
    };

    try {
      console.log("Generating project idea flow initiated...");
      // Call the prompt using the default model
      const { output: aiResult } = await ideaGenerationPrompt(input);

      // Validate required fields and estimatedHours > 0
      if (!aiResult?.idea || !aiResult?.estimatedTimeline || !aiResult?.estimatedHours || aiResult.estimatedHours <= 0) {
          console.error("AI failed to generate a complete project idea with positive estimates. Output:", aiResult);
          const reason = !aiResult?.estimatedHours || aiResult.estimatedHours <= 0
              ? "AI did not provide a valid positive hour estimate."
              : "AI failed to generate a complete project idea.";
          // Return a valid error response matching the schema
          return {
              ...fallbackOutput,
              reasoning: reason,
          };
      }

      // Calculate costs based on AI-estimated hours
      const baseCost = calculateEstimatedBaseCost(aiResult.estimatedHours, aiResult.requiredSkills);
      const fee = Number((baseCost * PLATFORM_MARKUP_PERCENTAGE).toFixed(2));
      const totalCost = Number((baseCost + fee).toFixed(2));

      console.log(`Generated idea: "${aiResult.idea}", Hours: ${aiResult.estimatedHours}, Base Cost: ${baseCost}, Total Cost: ${totalCost}`);

      return {
        idea: aiResult.idea,
        details: aiResult.details,
        estimatedTimeline: aiResult.estimatedTimeline,
        estimatedHours: aiResult.estimatedHours,
        estimatedBaseCost: baseCost,
        platformFee: fee,
        totalCostToClient: totalCost,
        monthlySubscriptionCost: MONTHLY_SUBSCRIPTION_COST, // Add fixed subscription cost
        reasoning: `AI generated idea and estimated scope. Costs calculated based on ${aiResult.estimatedHours} hours.`,
        status: 'success',
      };

    } catch (error: any) {
      console.error("Error during project idea generation flow:", error);
      // Differentiate between API key errors and other potential errors (like schema validation)
      let errorMessage = 'Failed to generate idea: Unknown error';
      if (error.message?.includes('API key') || error.message?.includes('Authentication failed')) {
         errorMessage = `Failed to generate idea: Invalid or missing GOOGLE_API_KEY. Please check your .env file. Original error: ${error.message}`;
      } else if (error.message?.includes('Schema validation failed') || error.message?.includes('positive hour estimate')) {
          errorMessage = `Failed to generate idea: AI response did not match expected format (e.g., missing fields or invalid hours). Original error: ${error.message}`;
      } else {
          errorMessage = `Failed to generate idea: ${error.message}`;
      }

       // Return the valid fallback object with the specific error message
       return {
           ...fallbackOutput,
           reasoning: errorMessage,
       };
    }
  }
);
