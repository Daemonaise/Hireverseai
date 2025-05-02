'use server';
/**
 * @fileOverview Estimates the impact of a client's project change request on timeline and cost.
 * Uses dynamic model selection via callAI.
 *
 * Exports:
 * - estimateProjectChangeImpact - A function that handles the estimation process.
 * - RequestProjectChangeInput - Input type.
 * - RequestProjectChangeOutput - Output type.
 */

import { callAI } from '@/ai/ai-instance'; // Import the centralized callAI function
import { z } from 'zod';
import {
  RequestProjectChangeInputSchema,
  type RequestProjectChangeInput,
  RequestProjectChangeOutputSchema,
  type RequestProjectChangeOutput,
} from '@/ai/schemas/request-project-change-schema';

// Export types separately
export type { RequestProjectChangeInput, RequestProjectChangeOutput };


// --- Helper: Extract JSON from potentially messy AI output ---
function extractJson(text: string): unknown | null {
    const match = text.match(/\{[\s\S]*\}/); // Basic object match
    if (match) {
        try {
            return JSON.parse(match[0]);
        } catch (e) {
            console.warn("JSON parsing failed:", e, "Raw Text:", text);
            return null;
        }
    }
    console.error("Could not find any JSON object in AI response:", text);
    return null;
}

// --- Main function ---
export async function estimateProjectChangeImpact(input: RequestProjectChangeInput): Promise<RequestProjectChangeOutput> {
  // Validate input
  RequestProjectChangeInputSchema.parse(input);

  console.log(`Estimating project change impact for project ${input.projectId}...`);

  // Construct the prompt for the callAI function
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
- Estimate the new delivery timeline based on the requested change. Provide a specific string (e.g., 'approx. 3 additional days', 'New target: YYYY-MM-DD', 'No significant impact').
- Estimate the additional cost in USD (must be a non-negative number). Provide 0 if no cost impact.
- Provide a brief impact analysis explaining your reasoning (1-2 sentences).

Return ONLY a JSON object matching exactly this structure:
{
  "estimatedNewTimeline": "Specific new timeline string",
  "estimatedAdditionalCost": number (non-negative),
  "impactAnalysis": "Brief analysis (1-2 sentences) explaining the timeline/cost changes (string)."
}
No extra explanations, no markdown, no formatting outside the JSON object. Ensure 'estimatedAdditionalCost' is a non-negative number.`;

  try {
    // Call the centralized AI function
    const responseText = await callAI(promptText);

    // Attempt to parse the JSON response
    let aiOutput: RequestProjectChangeOutput;
    try {
      const parsedJson = extractJson(responseText);
      if (!parsedJson) throw new Error("AI failed to return a valid JSON object for estimation.");

      // Validate the parsed JSON against the output schema
      const validationResult = RequestProjectChangeOutputSchema.safeParse(parsedJson);
      if (!validationResult.success) {
          throw new Error(`Invalid estimation structure: ${validationResult.error.errors.map(e => e.message).join(', ')}`);
      }
      aiOutput = validationResult.data; // Use validated data

      // Additional defensive checks (schema should catch negative cost)
      if (aiOutput.estimatedAdditionalCost < 0) {
        console.warn(`AI returned negative cost (${aiOutput.estimatedAdditionalCost}). Setting to 0.`);
        aiOutput.estimatedAdditionalCost = 0; // Correct negative cost
      }
    } catch (parseError: any) {
      console.error(`Error parsing change impact JSON for project ${input.projectId}:`, parseError.message, "Raw Response:", responseText);
      throw new Error(`Invalid AI response structure during change impact estimation: ${parseError.message}`);
    }

    console.log(`Successfully estimated change for project ${input.projectId}: Timeline - ${aiOutput.estimatedNewTimeline}, Additional Cost - $${aiOutput.estimatedAdditionalCost}`);
    return aiOutput;

  } catch (error: any) {
    // Catch errors from callAI or parsing/validation
    console.error(`Error estimating project change impact for project ${input.projectId}:`, error?.message ?? error);
    // Propagate the error to the caller
    throw new Error(`Failed to estimate project change impact: ${error?.message ?? 'Unknown error'}`);
  }
}
    
