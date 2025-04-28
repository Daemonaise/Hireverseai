
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

// Correctly import from the ai-instance module
import { chooseModelBasedOnPrompt, callAI } from '@/ai/ai-instance';
import { z } from 'zod'; // Use standard zod import
import {
    RequestProjectChangeInputSchema,
    type RequestProjectChangeInput,
    RequestProjectChangeOutputSchema,
    type RequestProjectChangeOutput,
} from '@/ai/schemas/request-project-change-schema';

// Export types
export type { RequestProjectChangeInput, RequestProjectChangeOutput };

// Main exported function
export async function estimateProjectChangeImpact(input: RequestProjectChangeInput): Promise<RequestProjectChangeOutput> {
    try {
        // 1. Choose model
        // Correctly use the imported function
        const selectedModel = chooseModelBasedOnPrompt(input.changeDescription);
        console.log(`Estimating impact for change request on project ${input.projectId} using model: ${selectedModel}`);

        // 2. Construct prompt
        const schemaDescription = `{
  "estimatedNewTimeline": "Specific new timeline (e.g., 'approx. 3 additional days', 'New target: YYYY-MM-DD', 'No significant impact')",
  "estimatedAdditionalCost": "Estimated additional cost in USD (non-negative number, e.g., 150.00 or 0).",
  "impactAnalysis": "Brief analysis (1-2 sentences) explaining timeline/cost changes."
}`;

        const promptText = `You are an AI Project Manager analyzing a change request for an ongoing project.
Your goal is to estimate the impact of this change on the project's timeline and cost, assuming fair US market rates for freelance work.

Project Details:
ID: ${input.projectId}
Original Brief: ${input.currentBrief}
Original Skills: ${input.currentSkills.join(', ')}
Current Estimated Timeline: ${input.currentTimeline}
Current Estimated Cost: $ ${input.currentCost.toFixed(2)}

Client's Change Request:
Description: ${input.changeDescription}
Priority: ${input.priority}

Analyze the change request in the context of the original project details.
1. Estimate the new delivery timeline. Be specific (e.g., "approx. 3 additional days", "New target: YYYY-MM-DD", "No significant impact").
2. Estimate any additional cost required in USD. Consider the complexity, skills involved, and typical US freelance rates (e.g., design ~\$60/hr, dev ~\$70/hr, writing ~\$55/hr). If no cost impact, return 0. Ensure the value is a non-negative number.
3. Provide a brief impact analysis (1-2 sentences) explaining your reasoning for the new timeline and cost estimates based on the requested change.

Return ONLY a JSON object strictly following this structure:
${schemaDescription}
Do not include any explanations or introductory text outside the JSON object. Ensure 'estimatedAdditionalCost' is a non-negative number.`;

        // 3. Call AI using the unified function
        const responseString = await callAI(selectedModel, promptText);

        // 4. Parse and validate response
        try {
            // Clean potential markdown code block fences
            const cleanedResponse = responseString.replace(/^```json\n?/, '').replace(/\n?```$/, '');
            const parsed = JSON.parse(cleanedResponse);
            const output = RequestProjectChangeOutputSchema.parse(parsed); // Validate against Zod schema

            if (!output || !output.estimatedNewTimeline || typeof output.estimatedAdditionalCost !== 'number' || output.estimatedAdditionalCost < 0 || !output.impactAnalysis) {
                console.error(`AI (${selectedModel}) failed to provide valid change impact estimations for project:`, input.projectId, "Output:", output, "Raw:", responseString);
                throw new Error(`AI (${selectedModel}) failed to provide valid estimations for the project change request (check cost >= 0).`);
            }

            console.log(`Estimation complete using ${selectedModel} for project ${input.projectId}: Timeline - ${output.estimatedNewTimeline}, Add. Cost - $${output.estimatedAdditionalCost}`);
            return output;

        } catch (parseError: any) {
            console.error(`Error parsing/validating AI response for change impact on project ${input.projectId} using ${selectedModel}:`, parseError.errors ?? parseError, "Raw Response:", responseString);
            throw new Error(`AI (${selectedModel}) returned an invalid response structure for change impact estimation.`);
        }

    } catch (error: any) {
        console.error(`Error estimating change impact for project ${input.projectId}:`, error);
        // Throw error to be caught by the caller
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to estimate project change impact: ${errorMessage}`);
    }
}
