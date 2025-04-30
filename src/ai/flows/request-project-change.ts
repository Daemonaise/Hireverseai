'use server';
/**
 * @fileOverview Estimates the impact of a client's project change request on timeline and cost.
 * Uses dynamic model selection based on the change description.
 *
 * Exports:
 * - estimateProjectChangeImpact - A function that handles the estimation process.
 * - RequestProjectChangeInput - Input type.
 * - RequestProjectChangeOutput - Output type.
 */

import { ai } from '@/ai/ai-instance'; // Import ai instance
import { chooseModelBasedOnPrompt } from '@/lib/model-selector';
import { z } from 'zod';
import {
  RequestProjectChangeInputSchema,
  type RequestProjectChangeInput,
  RequestProjectChangeOutputSchema,
  type RequestProjectChangeOutput,
} from '@/ai/schemas/request-project-change-schema';

// Export types separately
export type { RequestProjectChangeInput, RequestProjectChangeOutput };

// --- Main function ---
// Export only the async function
export async function estimateProjectChangeImpact(input: RequestProjectChangeInput): Promise<RequestProjectChangeOutput> {
  // Validate input (optional, often handled by caller/framework)
  RequestProjectChangeInputSchema.parse(input);

  try {
    // Determine model based on change description (uses centralized logic)
    const selectedModel = chooseModelBasedOnPrompt(input.changeDescription);
    console.log(`Estimating project change impact for project ${input.projectId} using model ${selectedModel}`);

    // Define the Genkit prompt
    const estimateChangePrompt = ai.definePrompt({
      name: `estimateChange_${input.projectId}`,
      input: { schema: RequestProjectChangeInputSchema },
      output: { schema: RequestProjectChangeOutputSchema },
      model: selectedModel,
      prompt: `You are an AI Project Manager analyzing a change request for an ongoing project.

Project Details:
- ID: {{{projectId}}}
- Original Brief: {{{currentBrief}}}
- Original Skills: {{{currentSkills.join(', ')}}}
- Current Estimated Timeline: {{{currentTimeline}}}
- Current Estimated Cost: $${input.currentCost.toFixed(2)} // Note: Handlebars doesn't support complex expressions like toFixed, pass formatted string if needed

Change Request:
- Description: {{{changeDescription}}}
- Priority: {{{priority}}}

Instructions:
- Estimate the new delivery timeline based on the requested change.
- Estimate the additional cost in USD (must be a non-negative number). Provide 0 if no cost impact.
- Provide a brief impact analysis explaining your reasoning.

Return ONLY a JSON object matching exactly this structure:
{
  "estimatedNewTimeline": "Specific new timeline (e.g., 'approx. 3 additional days', 'New target: YYYY-MM-DD', 'No significant impact')",
  "estimatedAdditionalCost": "Estimated additional cost in USD (non-negative number).",
  "impactAnalysis": "Brief analysis (1-2 sentences) explaining the timeline/cost changes."
}
No extra explanations, no markdown, no formatting outside the JSON object. Ensure 'estimatedAdditionalCost' is a non-negative number.`,
    });


    try {
       const { output } = await estimateChangePrompt(input);

       if (!output) {
         throw new Error(`AI (${selectedModel}) did not return a valid estimation.`);
       }

      // Schema validation is handled by definePrompt
      const validated = output; // Output matches the schema

      // Additional defensive checks (schema should catch these)
      if (validated.estimatedAdditionalCost < 0) {
        console.warn(`AI (${selectedModel}) returned negative cost (${validated.estimatedAdditionalCost}). Setting to 0.`);
        validated.estimatedAdditionalCost = 0; // Correct negative cost
      }

      console.log(`Successfully estimated change for project ${input.projectId}: Timeline - ${validated.estimatedNewTimeline}, Additional Cost - $${validated.estimatedAdditionalCost}`);
      return validated;

    } catch (aiError: any) {
      console.error(`Validation error parsing AI response for project ${input.projectId}:`, aiError?.errors ?? aiError, 'Input:', input);
      // Throw a more specific error to be caught by the outer catch block
      throw new Error(`Invalid AI response structure during change impact estimation.`);
    }
  } catch (error: any) {
    // Catch errors from prompt definition or execution
    console.error(`Error estimating project change impact for project ${input.projectId}:`, error?.message ?? error);
    // Propagate the error to the caller
    throw new Error(`Failed to estimate project change impact: ${error?.message ?? 'Unknown error'}`);
  }
}
