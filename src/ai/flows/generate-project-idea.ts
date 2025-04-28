
'use server';
/**
 * @fileOverview Generates a project idea with cost and timeline estimations.
 * Uses dynamic model selection based on optional industry hint.
 *
 * Exports:
 * - generateProjectIdea - A function that generates a project idea.
 * - GenerateProjectIdeaInput - Input type.
 * - GenerateProjectIdeaOutput - Output type.
 */

// Correctly import from the ai-instance module
import { chooseModelBasedOnPrompt, callAI } from '@/ai/ai-instance';
import { z } from 'zod'; // Use standard zod import
import {
    GenerateProjectIdeaInputSchema,
    type GenerateProjectIdeaInput,
    GenerateProjectIdeaOutputSchema,
    type GenerateProjectIdeaOutput,
    GenerateProjectIdeaAIOutputSchema, // Schema for what the AI should return
    type GenerateProjectIdeaAIOutput, // Type for what the AI should return
} from '@/ai/schemas/generate-project-idea-schema';

// --- Constants ---
const PLATFORM_MARKUP_PERCENTAGE = 0.15;
const DEFAULT_HOURLY_RATE_USD = 50;
const TECH_HOURLY_RATE_USD = 70;
const DESIGN_HOURLY_RATE_USD = 60;
const WRITING_HOURLY_RATE_USD = 55;
const MONTHLY_SUBSCRIPTION_COST = 20; // Assuming this is fixed for now

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

// Export types
export type { GenerateProjectIdeaInput, GenerateProjectIdeaOutput };

// --- Exported Flow Function ---
export async function generateProjectIdea(input: GenerateProjectIdeaInput): Promise<GenerateProjectIdeaOutput> {
    // Define a reliable fallback output structure
    const fallbackOutput: GenerateProjectIdeaOutput = {
        idea: "Error Generating Idea",
        estimatedTimeline: "N/A",
        estimatedHours: undefined,
        reasoning: 'An error occurred during idea generation.',
        status: 'error',
        estimatedBaseCost: undefined,
        platformFee: undefined,
        totalCostToClient: undefined,
        monthlySubscriptionCost: MONTHLY_SUBSCRIPTION_COST,
        details: undefined,
        requiredSkills: [],
    };

    try {
        // 1. Choose model
        const promptContext = input.industryHint || "general project idea";
        // Correctly use the imported function
        const selectedModel = chooseModelBasedOnPrompt(promptContext);
        console.log(`Generating project idea using model: ${selectedModel}`);

        // 2. Construct prompt
        const schemaDescription = `{
  "idea": "Suggest a concise and actionable project idea suitable for freelance execution. Be creative!",
  "details": "Optional: Provide 1-2 sentences elaborating on the suggested project idea.",
  "estimatedTimeline": "Estimate a realistic project delivery timeline (e.g., '3-5 days', '1-2 weeks').",
  "estimatedHours": "Estimate the total number of hours required (fair US market standard, must be > 0).",
  "requiredSkills": ["Optional: List 1-3 key skills potentially needed."]
}`;

        const promptText = `Generate a creative and actionable project idea that could be completed by freelancers on a platform like Hireverse AI.
Consider typical freelance tasks like web design, writing, graphic design, development, etc.
${input.industryHint ? `Focus the idea around the following industry or type: ${input.industryHint}` : ''}

Provide:
1. A short, compelling project 'idea'.
2. Optional brief 'details' elaborating on the idea (1-2 sentences).
3. An estimated 'timeline' for completion (e.g., "2-3 days", "about 1 week").
4. An estimated number of 'hours' required (be realistic, e.g., 5-40 hours, MUST be a positive number greater than 0).
5. Optionally, list 1-3 key 'requiredSkills'.

Output ONLY the JSON object matching the specified output structure:
${schemaDescription}
Do not include any introductory text or explanations outside the JSON object. Ensure 'estimatedHours' is a positive number > 0.`;

        // 3. Call AI using the unified function
        const responseString = await callAI(selectedModel, promptText);

        // 4. Parse and validate AI response
        let aiResult: GenerateProjectIdeaAIOutput;
        try {
            // Clean potential markdown code block fences
            const cleanedResponse = responseString.replace(/^```json\n?/, '').replace(/\n?```$/, '');
            const parsed = JSON.parse(cleanedResponse);
            aiResult = GenerateProjectIdeaAIOutputSchema.parse(parsed); // Validate against the AI output schema

            // Additional validation for estimatedHours > 0
            if (aiResult.estimatedHours <= 0) {
                console.error(`AI (${selectedModel}) returned a non-positive hour estimate: ${aiResult.estimatedHours}`);
                throw new Error(`AI (${selectedModel}) did not provide a valid positive hour estimate.`);
            }

        } catch (parseError: any) {
            console.error(`Error parsing/validating AI response for idea generation using ${selectedModel}:`, parseError.errors ?? parseError, "Raw Response:", responseString);
            throw new Error(`AI (${selectedModel}) returned an invalid response structure or failed validation (check estimatedHours > 0).`);
        }

        // 5. Calculate costs based on AI output
        const baseCost = calculateEstimatedBaseCost(aiResult.estimatedHours, aiResult.requiredSkills);
        const fee = Number((baseCost * PLATFORM_MARKUP_PERCENTAGE).toFixed(2));
        const totalCost = Number((baseCost + fee).toFixed(2));

        console.log(`Generated idea using ${selectedModel}: "${aiResult.idea}", Hours: ${aiResult.estimatedHours}, Base Cost: ${baseCost}, Total Cost: ${totalCost}`);

        // 6. Construct final output
        const finalOutput: GenerateProjectIdeaOutput = {
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
        return finalOutput;

    } catch (error: any) {
        console.error(`Error during project idea generation flow:`, error);
        // Check if the error message indicates an API key issue
        const isApiKeyError = error.message?.includes('API key');
        let errorMessage = isApiKeyError
           ? `Failed to generate idea: Invalid or missing API Key.`
           : `Failed to generate idea: ${error.message || 'Unknown error'}`;

        // Return the fallback output with the specific error message
        return {
            ...fallbackOutput,
            reasoning: errorMessage,
        };
    }
}
