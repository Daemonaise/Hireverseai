'use server';
/**
 * @fileOverview Generates a project idea with cost and timeline estimations.
 * Uses dynamic model selection based on optional industry hint.
 *
 * Exports:
 * - generateProjectIdea - A function that generates a project idea.
 */

import { ai, chooseModelBasedOnPrompt } from '@/ai/ai-instance'; // Import chooseModelBasedOnPrompt
import { z } from 'genkit';
import {
    GenerateProjectIdeaInputSchema, // Import schema definition
    type GenerateProjectIdeaInput, // Export type only
    GenerateProjectIdeaOutputSchema, // Import schema definition
    type GenerateProjectIdeaOutput, // Export type only
} from '@/ai/schemas/generate-project-idea-schema';

// --- Constants ---
const PLATFORM_MARKUP_PERCENTAGE = 0.15;
const DEFAULT_HOURLY_RATE_USD = 50;
const TECH_HOURLY_RATE_USD = 70;
const DESIGN_HOURLY_RATE_USD = 60;
const WRITING_HOURLY_RATE_USD = 55;
const MONTHLY_SUBSCRIPTION_COST = 20;

// --- Helper Functions ---
// Keep internal, do not export
function calculateEstimatedBaseCost(hours: number, skills?: string[]): number {
    let averageRate = DEFAULT_HOURLY_RATE_USD;
    if (skills && skills.length > 0) {
        const lowerCaseSkills = skills.map(s => s.toLowerCase());
        if (lowerCaseSkills.some(s => s.includes('develop') || s.includes('tech') || s.includes('code') || s.includes('software') || s.includes('engineer'))) {
            averageRate = TECH_HOURLY_RATE_USD;
        } else if (lowerCaseSkills.some(s => s.includes('design') || s.includes('graphic') || s.includes('ui/ux') || s.includes('illustrat'))) {
            averageRate = DESIGN_HOURLY_RATE_USD;
        } else if (lowerCaseSkills.some(s => s.includes('writing') || s.includes('edit') || s.includes('copywrit') || s.includes('content'))) {
            averageRate = WRITING_HOURLY_RATE_USD;
        } else if (lowerCaseSkills.some(s => s.includes('cad') || s.includes('drafting') || s.includes('engineer'))) {
             averageRate = TECH_HOURLY_RATE_USD;
        }
    }
    const estimatedBaseCost = hours * averageRate;
    return Number(estimatedBaseCost.toFixed(2));
}

// --- AI Prompt Definition Generator ---
// Keep internal, do not export
const createIdeaGenerationPrompt = (modelName: string) => ai.definePrompt({
  name: `ideaGenerationPrompt_${modelName.replace(/[^a-zA-Z0-9]/g, '_')}`,
  input: { schema: GenerateProjectIdeaInputSchema },
  model: modelName, // Use dynamically selected model
  output: { schema: z.object({
      idea: z.string().describe('Suggest a concise and actionable project idea suitable for freelance execution. Be creative!'),
      details: z.string().optional().describe('Provide 1-2 sentences elaborating on the suggested project idea.'),
      estimatedTimeline: z.string().describe('Estimate a realistic project delivery timeline (e.g., "3-5 days", "1-2 weeks").'),
      // Ensure schema here matches DecomposeProjectSchema's minimum requirement
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
      temperature: 0.8,
  },
});

// Export only the async wrapper function and types
export type { GenerateProjectIdeaInput, GenerateProjectIdeaOutput };

// --- Exported Flow Function ---
export async function generateProjectIdea(input: GenerateProjectIdeaInput): Promise<GenerateProjectIdeaOutput> {
  return generateProjectIdeaFlow(input);
}

// --- Main Flow Definition ---
// Keep internal, do not export
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
    const fallbackOutput: GenerateProjectIdeaOutput = {
        idea: "Error Generating Idea",
        estimatedTimeline: "N/A",
        estimatedHours: undefined, // Set to undefined initially
        reasoning: 'Failed to generate idea due to an error.',
        status: 'error',
        estimatedBaseCost: undefined,
        platformFee: undefined,
        totalCostToClient: undefined,
        monthlySubscriptionCost: MONTHLY_SUBSCRIPTION_COST,
        details: undefined,
        requiredSkills: [],
    };

    // Choose model based on industry hint or default if none - Await the async function
    const promptContext = input.industryHint || "general project idea";
    const selectedModel = await chooseModelBasedOnPrompt(promptContext);
    console.log(`Generating project idea using model: ${selectedModel}`);

    try {
      // Create the specific prompt definition
      const ideaGenerationPrompt = createIdeaGenerationPrompt(selectedModel);

      // Call the dynamically created prompt
      const { output: aiResult } = await ideaGenerationPrompt(input);

      if (!aiResult?.idea || !aiResult?.estimatedTimeline || !aiResult?.estimatedHours || aiResult.estimatedHours <= 0) {
          console.error(`AI (${selectedModel}) failed to generate a complete project idea with positive estimates. Output:`, aiResult);
          const reason = !aiResult?.estimatedHours || aiResult.estimatedHours <= 0
              ? `AI (${selectedModel}) did not provide a valid positive hour estimate.`
              : `AI (${selectedModel}) failed to generate a complete project idea.`;
          return { ...fallbackOutput, estimatedHours: 0.1, reasoning: reason }; // Ensure estimatedHours has a fallback value
      }

      const baseCost = calculateEstimatedBaseCost(aiResult.estimatedHours, aiResult.requiredSkills);
      const fee = Number((baseCost * PLATFORM_MARKUP_PERCENTAGE).toFixed(2));
      const totalCost = Number((baseCost + fee).toFixed(2));

      console.log(`Generated idea using ${selectedModel}: "${aiResult.idea}", Hours: ${aiResult.estimatedHours}, Base Cost: ${baseCost}, Total Cost: ${totalCost}`);

      return {
        idea: aiResult.idea,
        details: aiResult.details,
        estimatedTimeline: aiResult.estimatedTimeline,
        estimatedHours: aiResult.estimatedHours,
        estimatedBaseCost: baseCost,
        platformFee: fee,
        totalCostToClient: totalCost,
        monthlySubscriptionCost: MONTHLY_SUBSCRIPTION_COST,
        reasoning: `AI (${selectedModel}) generated idea and estimated scope. Costs calculated based on ${aiResult.estimatedHours} hours.`,
        status: 'success',
        requiredSkills: aiResult.requiredSkills ?? [],
      };

    } catch (error: any) {
      console.error(`Error during project idea generation flow using ${selectedModel}:`, error);
      let errorMessage = `Failed to generate idea with ${selectedModel}: Unknown error`;
      if (error.message?.includes('API key') || error.message?.includes('Authentication failed')) {
         errorMessage = `Failed to generate idea with ${selectedModel}: Invalid or missing API Key. ${error.message}`;
      } else if (error.message?.includes('Schema validation failed') || error.message?.includes('positive hour estimate') || error.message?.includes('INVALID_ARGUMENT')) {
          errorMessage = `Failed to generate idea with ${selectedModel}: AI response did not match expected format. ${error.message}`;
          console.error("Detailed Error:", error.details);
      } else {
          errorMessage = `Failed to generate idea with ${selectedModel}: ${error.message}`;
      }

       return { ...fallbackOutput, estimatedHours: 0.1, reasoning: errorMessage }; // Ensure estimatedHours has a fallback value
    }
  }
);
