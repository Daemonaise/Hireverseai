'use server';
/**
 * @fileOverview Estimates the impact of a client's project change request on timeline and cost.
 *
 * Exports:
 * - estimateProjectChangeImpact - A function that handles the estimation process.
 * - RequestProjectChangeInput - Input type.
 * - RequestProjectChangeOutput - Output type.
 */

import { ai } from '@/ai/ai-instance'; // Import the configured ai instance
import { z } from 'zod';
import {
  RequestProjectChangeInputSchema,
  type RequestProjectChangeInput,
  RequestProjectChangeOutputSchema,
  type RequestProjectChangeOutput,
} from '@/ai/schemas/request-project-change-schema';

// Export types separately
export type { RequestProjectChangeInput, RequestProjectChangeOutput };

// --- Define the Prompt ---
const estimateChangePrompt = ai.definePrompt({
  name: 'estimateChangePrompt',
  input: { schema: RequestProjectChangeInputSchema },
  output: { schema: RequestProjectChangeOutputSchema },
  // model: 'googleai/gemini-1.5-flash', // Example: Specify model if needed
  prompt: `You are an AI Project Manager analyzing a change request for an ongoing project.

Project Details:
- ID: {{{projectId}}}
- Original Brief: {{{currentBrief}}}
- Original Skills: {{#each currentSkills}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
- Current Estimated Timeline: {{{currentTimeline}}}
- Current Estimated Cost: $${ RequestProjectChangeInputSchema.shape.currentCost.parse(0).toFixed(2) /* Placeholder formatting, adjust if needed */}

Change Request:
- Description: {{{changeDescription}}}
- Priority: {{{priority}}}

Instructions:
- Estimate the new delivery timeline based on the requested change. Provide a specific string (e.g., 'approx. 3 additional days', 'New target: YYYY-MM-DD', 'No significant impact').
- Estimate the additional cost in USD (must be a non-negative number). Provide 0 if no cost impact.
- Provide a brief impact analysis explaining your reasoning (1-2 sentences).

Return ONLY a JSON object matching exactly this structure:
{
  "estimatedNewTimeline": "Specific new timeline string",
  "estimatedAdditionalCost": number (non-negative),
  "impactAnalysis": "Brief analysis (1-2 sentences) explaining the timeline/cost changes (string)."
}
No extra explanations, no markdown, no formatting outside the JSON object. Ensure 'estimatedAdditionalCost' is a non-negative number.`,
});


// --- Define the Flow ---
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
    console.log(`Estimating project change impact for project ${input.projectId}...`);

    try {
      // Call the defined prompt
      const { output: aiOutput } = await estimateChangePrompt(input);

      if (!aiOutput) {
        throw new Error("AI failed to return a valid JSON object for estimation.");
      }

      // Validate AI output structure (already done by prompt definition)
      // Additional defensive checks
      if (aiOutput.estimatedAdditionalCost < 0) {
        console.warn(`AI returned negative cost (${aiOutput.estimatedAdditionalCost}). Setting to 0.`);
        aiOutput.estimatedAdditionalCost = 0; // Correct negative cost
      }

      console.log(`Successfully estimated change for project ${input.projectId}: Timeline - ${aiOutput.estimatedNewTimeline}, Additional Cost - $${aiOutput.estimatedAdditionalCost}`);
      return aiOutput;

    } catch (error: any) {
      // Catch errors from AI call or parsing/validation
      console.error(`Error estimating project change impact for project ${input.projectId}:`, error?.message ?? error);
      // Propagate the error to the caller
      throw new Error(`Failed to estimate project change impact: ${error?.message ?? 'Unknown error'}`);
    }
  }
);

// --- Main Exported Function (Wrapper) ---
export async function estimateProjectChangeImpact(input: RequestProjectChangeInput): Promise<RequestProjectChangeOutput> {
  // Input validation handled by the flow
  RequestProjectChangeInputSchema.parse(input);
  return estimateProjectChangeImpactFlow(input);
}
