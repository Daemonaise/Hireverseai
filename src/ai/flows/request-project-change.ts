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

import { callAI } from '@/ai/ai-instance';
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
  // RequestProjectChangeInputSchema.parse(input);

  try {
    // Determine model based on change description (uses centralized logic)
    const selectedModel = chooseModelBasedOnPrompt(input.changeDescription);
    console.log(`Estimating project change impact for project ${input.projectId} using model ${selectedModel}`);

    // Describe the expected JSON output format for the AI
    const schemaDescription = `{
  "estimatedNewTimeline": "Specific new timeline (e.g., 'approx. 3 additional days', 'New target: YYYY-MM-DD', 'No significant impact')",
  "estimatedAdditionalCost": "Estimated additional cost in USD (non-negative number).",
  "impactAnalysis": "Brief analysis (1-2 sentences) explaining the timeline/cost changes."
}`;

    // Construct the prompt for the AI
    const promptText = `You are an AI Project Manager analyzing a change request for an ongoing project.

Project Details:
- ID: ${input.projectId}
- Original Brief: ${input.currentBrief}
- Original Skills: ${input.currentSkills.join(', ')}
- Current Estimated Timeline: ${input.currentTimeline}
- Current Estimated Cost: $${input.currentCost.toFixed(2)}

Change Request:
- Description: ${input.changeDescription}
- Priority: ${input.priority}

Instructions:
- Estimate the new delivery timeline based on the requested change.
- Estimate the additional cost in USD (must be a non-negative number). Provide 0 if no cost impact.
- Provide a brief impact analysis explaining your reasoning.

Return ONLY a JSON object matching exactly this structure:
${schemaDescription}
No extra explanations, no markdown, no formatting outside the JSON object. Ensure 'estimatedAdditionalCost' is a non-negative number.`;

    // Use the centralized callAI function
    const responseString = await callAI('auto', promptText); // Let model selector choose

    try {
      const cleanedResponse = responseString.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      const parsed = JSON.parse(cleanedResponse);

      // Validate the parsed JSON against the output schema
      const validated = RequestProjectChangeOutputSchema.parse(parsed);

      // Additional defensive checks (schema should catch these)
      if (validated.estimatedAdditionalCost < 0) {
        console.warn(`AI (${selectedModel}) returned negative cost (${validated.estimatedAdditionalCost}). Setting to 0.`);
        validated.estimatedAdditionalCost = 0; // Correct negative cost
      }

      console.log(`Successfully estimated change for project ${input.projectId}: Timeline - ${validated.estimatedNewTimeline}, Additional Cost - $${validated.estimatedAdditionalCost}`);
      return validated;

    } catch (parseError: any) {
      console.error(`Validation error parsing AI response for project ${input.projectId}:`, parseError?.errors ?? parseError, 'Raw Response:', responseString);
      // Throw a more specific error to be caught by the outer catch block
      throw new Error(`Invalid AI response structure during change impact estimation.`);
    }
  } catch (error: any) {
    // Catch errors from callAI or the inner try-catch block
    console.error(`Error estimating project change impact for project ${input.projectId}:`, error?.message ?? error);
    // Propagate the error to the caller
    throw new Error(`Failed to estimate project change impact: ${error?.message ?? 'Unknown error'}`);
  }
}
