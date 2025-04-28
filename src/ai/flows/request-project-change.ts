

/**
 * @fileOverview Estimates the impact of a client's project change request on timeline and cost.
 * Uses the default Google AI model.
 *
 * Exports:
 * - estimateProjectChangeImpact - A function that handles the estimation process.
 */

import { ai } from '@/ai/ai-instance'; // Import the configured 'ai' instance
import { z } from 'genkit';
import {
    RequestProjectChangeInputSchema,
    type RequestProjectChangeInput, // Keep type import for internal use
    RequestProjectChangeOutputSchema,
    type RequestProjectChangeOutput, // Export output type
} from '@/ai/schemas/request-project-change-schema';

// 'use server'; - Not needed here, it's a standard async function
export async function estimateProjectChangeImpact(input: RequestProjectChangeInput): Promise<RequestProjectChangeOutput> {
  return estimateProjectChangeImpactFlow(input);
}

const prompt = ai.definePrompt({
  name: 'estimateProjectChangeImpactPrompt',
  input: { schema: RequestProjectChangeInputSchema },
  output: { schema: RequestProjectChangeOutputSchema },
  // Model defaults to the one configured in ai-instance.ts
  prompt: `You are an AI Project Manager analyzing a change request for an ongoing project.
Your goal is to estimate the impact of this change on the project's timeline and cost, assuming fair US market rates for freelance work.

Project Details:
ID: {{{projectId}}}
Original Brief: {{{currentBrief}}}
Original Skills: {{#each currentSkills}} - {{this}} {{/each}}
Current Estimated Timeline: {{{currentTimeline}}}
Current Estimated Cost: $ {{{currentCost}}}

Client's Change Request:
Description: {{{changeDescription}}}
Priority: {{{priority}}}

Analyze the change request in the context of the original project details.
1. Estimate the new delivery timeline. Be specific (e.g., "approx. 3 additional days", "New target: YYYY-MM-DD", "No significant impact").
2. Estimate any additional cost required in USD. Consider the complexity, skills involved, and typical US freelance rates (e.g., design ~\$60/hr, dev ~\$70/hr, writing ~\$55/hr). If no cost impact, return 0. Ensure the value is non-negative.
3. Provide a brief impact analysis (1-2 sentences) explaining your reasoning for the new timeline and cost estimates.

Return the result strictly following the output schema with 'estimatedNewTimeline', 'estimatedAdditionalCost' (non-negative), and 'impactAnalysis'.`,
  config: {
    temperature: 0.4, // Slightly creative but grounded for estimation
  },
});

const estimateProjectChangeImpactFlow = ai.defineFlow<
  typeof RequestProjectChangeInputSchema,
  typeof RequestProjectChangeOutputSchema
>(
  {
    name: 'estimateProjectChangeImpactFlow',
    inputSchema: RequestProjectChangeInputSchema,
    outputSchema: RequestProjectChangeOutputSchema,
  },
  async (input) => {
    console.log(`Estimating impact for change request on project ${input.projectId} using default model`);
     try {
        // Call the prompt using the default model
        const { output } = await prompt(input);

        if (!output || !output.estimatedNewTimeline || typeof output.estimatedAdditionalCost !== 'number' || output.estimatedAdditionalCost < 0 || !output.impactAnalysis) {
            console.error("AI failed to provide valid change impact estimations for project:", input.projectId, "Output:", output);
            throw new Error("AI failed to provide valid estimations for the project change request (check cost >= 0).");
        }

        console.log(`Estimation complete for project ${input.projectId}: Timeline - ${output.estimatedNewTimeline}, Add. Cost - $${output.estimatedAdditionalCost}`);
        return output;
     } catch (error: any) {
         console.error(`Error estimating change impact for project ${input.projectId}:`, error);
         if (error.message?.includes('API key')) {
             console.error(`Ensure your GOOGLE_API_KEY is valid and has permissions.`);
         } else if (error.message?.includes('INVALID_ARGUMENT')) {
             console.error(`Invalid argument error estimating change impact for project ${input.projectId}. Check prompt/schema. Error:`, error.details);
         }
         throw new Error(`Failed to estimate project change impact: ${error.message}`);
     }
  }
);
