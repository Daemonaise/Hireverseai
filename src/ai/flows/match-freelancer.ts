
'use server';
/**
 * @fileOverview Matches a project brief with the best-fit, available freelancers,
 * and provides cost/timeline estimates.
 * Considers availability, skills, and estimates project scope.
 * Uses dynamic model selection based on project brief content.
 *
 * Exports:
 * - matchFreelancer - A function that handles the freelancer matching and estimation process.
 * - MatchFreelancerInput - Input type.
 * - MatchFreelancerOutput - Output type.
 */

// Correctly import from the ai-instance module
import { chooseModelBasedOnPrompt, callAI, getUserSpecificModel } from '@/ai/ai-instance';
import { z } from 'zod'; // Use standard zod import
import { getAvailableFreelancersBySkill } from '@/services/firestore';
import type { Freelancer } from '@/types/freelancer';
import {
    MatchFreelancerInputSchema,
    type MatchFreelancerInput,
    MatchFreelancerOutputSchema,
    type MatchFreelancerOutput,
    ExtractSkillsAIOutputSchema, // Schema for AI skill extraction
    type ExtractSkillsAIOutput,
    EstimateAndSelectAIOutputSchema, // Schema for AI estimation/selection
    type EstimateAndSelectAIOutput,
} from '@/ai/schemas/match-freelancer-schema';

// --- Constants ---
const PLATFORM_MARKUP_PERCENTAGE = 0.15;
const DEFAULT_HOURLY_RATE_USD = 50;
const TECH_HOURLY_RATE_USD = 70;
const DESIGN_HOURLY_RATE_USD = 60;
const WRITING_HOURLY_RATE_USD = 55;

// --- Helper Functions ---
function calculateEstimatedBaseCost(hours: number, skills: string[]): number {
    let averageRate = DEFAULT_HOURLY_RATE_USD;
    const lowerCaseSkills = skills.map(s => s.toLowerCase());
    if (lowerCaseSkills.some(s => s.includes('develop') || s.includes('software') || s.includes('engineer') || s.includes('code') || s.includes('python') || s.includes('react') || s.includes('node') || s.includes('tech'))) {
        averageRate = TECH_HOURLY_RATE_USD;
    } else if (lowerCaseSkills.some(s => s.includes('design') || s.includes('graphic') || s.includes('ui/ux') || s.includes('illustrat'))) {
        averageRate = DESIGN_HOURLY_RATE_USD;
    } else if (lowerCaseSkills.some(s => s.includes('writing') || s.includes('edit') || s.includes('copywrit') || s.includes('content'))) {
        averageRate = WRITING_HOURLY_RATE_USD;
    }
    return Number((hours * averageRate).toFixed(2));
}

// Export types
export type { MatchFreelancerInput, MatchFreelancerOutput };

// --- Exported Flow Function (Server Action) ---
export async function matchFreelancer(input: MatchFreelancerInput): Promise<MatchFreelancerOutput> {
    let requiredSkills = input.requiredSkills ?? [];
    let extractedSkills: string[] | undefined = undefined;
    let aiEstimateResult: EstimateAndSelectAIOutput | null = null;
    let estimatedBaseCost = 0;
    let platformFee = 0;
    let totalCostToClient = 0;
    let selectedModel: string; // Explicitly type as string

    // Define fallback output structure
    const fallbackOutput: MatchFreelancerOutput = {
       reasoning: 'An error occurred during the matching process.',
       status: 'error',
       estimatedTimeline: "N/A",
       estimatedHours: undefined,
       estimatedBaseCost: undefined,
       platformFee: undefined,
       totalCostToClient: undefined,
       extractedSkills: undefined,
    };

    try {
        // Determine the model to use
        // Check for user-specific model first
        let modelOverride = getUserSpecificModel(input.freelancerId);
        if (modelOverride) {
            selectedModel = modelOverride;
            console.log(`Using user-specific model: ${selectedModel}`);
        } else {
            // Choose model based on the project brief content if no user-specific model
            // Correctly use the imported function
            selectedModel = chooseModelBasedOnPrompt(input.projectBrief);
            console.log(`Starting freelancer match flow using model: ${selectedModel}`);
        }

        // 1. Extract Skills if necessary
        if (!requiredSkills || requiredSkills.length === 0) {
            console.log(`No skills provided, extracting from brief using ${selectedModel}...`);
            const extractSkillsPrompt = `Analyze the following project brief and extract the key skills required.
Focus on technical skills, software proficiency, and specific expertise mentioned.
Return ONLY a JSON object with a single key "extractedSkills" containing a list of 1-5 skill names. If no specific skills are mentioned, infer the most likely general skill category (e.g., "Graphic Design", "Web Development", "Copywriting").

Project Brief:
${input.projectBrief}

Example Output: {"extractedSkills": ["React", "Node.js", "UI Design"]}
Do not include any explanations outside the JSON object.`;

            // Call AI using the unified function
            const skillResponseString = await callAI(selectedModel, extractSkillsPrompt);
            try {
                const cleanedResponse = skillResponseString.replace(/^```json\n?/, '').replace(/\n?```$/, '');
                const skillExtractionResult = ExtractSkillsAIOutputSchema.parse(JSON.parse(cleanedResponse));
                if (!skillExtractionResult?.extractedSkills || skillExtractionResult.extractedSkills.length === 0) {
                    throw new Error(`AI (${selectedModel}) could not extract required skills from the project brief.`);
                }
                requiredSkills = skillExtractionResult.extractedSkills;
                extractedSkills = requiredSkills; // Store extracted skills for the output
                console.log(`Extracted skills using ${selectedModel}: ${requiredSkills.join(', ')}`);
            } catch (parseError: any) {
                 console.error(`Error parsing/validating skill extraction response using ${selectedModel}:`, parseError.errors ?? parseError, "Raw Response:", skillResponseString);
                 throw new Error(`AI (${selectedModel}) returned an invalid response structure for skill extraction.`);
            }
        }

        // 2. Get Available Freelancers (Firestore logic remains the same)
        console.log(`Searching for available freelancers with skills: ${requiredSkills.join(', ')}`);
        const availableFreelancers = await getAvailableFreelancersBySkill(requiredSkills, 5); // Limit to 5 for the prompt
        console.log(`Found ${availableFreelancers.length} potentially suitable freelancers.`);

        // 3. Estimate Scope and Select Match
        console.log(`Estimating project scope and selecting freelancer (if available) using ${selectedModel}...`);

        // Prepare freelancer data for the prompt
        const freelancerPromptData = availableFreelancers.length > 0 ? availableFreelancers.map(f => ({
            id: f.id!,
            skills: f.skills,
            xp: f.xp ?? 0,
            testScores: f.testScores ?? {},
        })) : [];

        // Define the schema description for the AI output
        const estimateSchemaDescription = `{
  "selectedFreelancerId": "Optional: ID of the chosen freelancer, or empty string/null if none suitable/available.",
  "reasoning": "Justification for selection or why none chosen. Include estimation rationale.",
  "estimatedHours": "Estimated total hours required (must be > 0).",
  "estimatedTimeline": "Estimated delivery timeline (e.g., '2-3 days', '1 week')."
}`;

        const estimatePromptText = `You are an AI Project Manager responsible for estimating project scope and assigning tasks to freelancers. Your estimations should reflect fair US market wages.

First, analyze the project brief and required skills to estimate the effort involved.
- Estimate the total number of hours required to complete the project. Be realistic, considering fair US market standards. The estimate MUST be a positive number greater than 0.
- Estimate a likely delivery timeline (e.g., "1-2 business days", "about 1 week", "approx. 2 weeks").

Project Brief: ${input.projectBrief}
Required Skills: ${requiredSkills.join(', ')}

${availableFreelancers.length > 0 ? `
Next, review the list of available freelancers who possess at least one required skill, are logged in, and marked as 'available'.

Available Freelancers (Sorted by general availability/rank):
${freelancerPromptData.map(f => `---
Freelancer ID: ${f.id}
Skills: ${f.skills.join(', ')}
XP: ${f.xp}
Test Scores: ${Object.entries(f.testScores).map(([key, value]) => `${key}: ${value}/100`).join(', ') || 'N/A'}
---`).join('\n')}

Select the *single best* freelancer for this project from the available list.
Prioritize freelancers who:
1. Possess *all* or the *most critical* required skills.
2. Have higher relevant skill test scores (if available).
3. Have higher XP (as a secondary factor).

If multiple freelancers are equally suitable, the first one listed is acceptable.
If no freelancer in the list meets the essential skill requirements adequately, do not select anyone.

Provide the ID of the selected freelancer (or empty string/null if none selected) and a brief reasoning for your choice, incorporating your estimations.`
: `No freelancers provided. Focus solely on estimating the project scope based on the brief and skills. Provide reasoning based on the estimation. Do not select a freelancer ID.`
}

Return ONLY a JSON object strictly following this structure:
${estimateSchemaDescription}
Ensure 'estimatedHours' is a positive number > 0.
Do not include any explanations or introductory text outside the JSON object.`;

        // Call AI using the unified function
        const estimateResponseString = await callAI(selectedModel, estimatePromptText);

        // Parse and validate the estimation response
        try {
            const cleanedResponse = estimateResponseString.replace(/^```json\n?/, '').replace(/\n?```$/, '');
            aiEstimateResult = EstimateAndSelectAIOutputSchema.parse(JSON.parse(cleanedResponse));

            if (!aiEstimateResult?.estimatedTimeline || !aiEstimateResult?.estimatedHours || aiEstimateResult.estimatedHours <= 0) {
                const reason = !aiEstimateResult?.estimatedHours || aiEstimateResult.estimatedHours <= 0
                    ? `AI (${selectedModel}) did not provide a valid positive hour estimate.`
                    : `AI (${selectedModel}) failed to provide necessary project estimations (hours/timeline).`;
                throw new Error(reason);
            }
        } catch (parseError: any) {
            console.error(`Error parsing/validating estimation response using ${selectedModel}:`, parseError.errors ?? parseError, "Raw Response:", estimateResponseString);
            throw new Error(`AI (${selectedModel}) returned an invalid response structure for estimation/selection (check estimatedHours > 0).`);
        }


        // 4. Calculate Costs
        estimatedBaseCost = calculateEstimatedBaseCost(aiEstimateResult.estimatedHours, requiredSkills);
        platformFee = Number((estimatedBaseCost * PLATFORM_MARKUP_PERCENTAGE).toFixed(2));
        totalCostToClient = Number((estimatedBaseCost + platformFee).toFixed(2));

        console.log(`AI (${selectedModel}) estimated ${aiEstimateResult.estimatedHours} hours, timeline: ${aiEstimateResult.estimatedTimeline}`);
        console.log(`Calculated Costs - Base: $${estimatedBaseCost}, Fee: $${platformFee}, Total: $${totalCostToClient}`);

        // 5. Handle No Match Scenario
        if (availableFreelancers.length === 0 || !aiEstimateResult.selectedFreelancerId) {
            const reasoning = availableFreelancers.length === 0
                ? `No freelancers are currently available with the required skills. Project scope estimated by ${selectedModel}.`
                : (aiEstimateResult.reasoning || `AI (${selectedModel}) determined no available candidate was a suitable match. Project scope estimated.`);
            console.log(`No suitable freelancer matched. Reasoning: ${reasoning}`);
            return {
                reasoning: reasoning,
                estimatedBaseCost: estimatedBaseCost,
                platformFee: platformFee,
                totalCostToClient: totalCostToClient,
                estimatedTimeline: aiEstimateResult.estimatedTimeline,
                estimatedHours: aiEstimateResult.estimatedHours,
                extractedSkills: extractedSkills,
                status: availableFreelancers.length === 0 ? 'no_available_freelancer' : 'estimation_only',
            };
        }

        // 6. Handle Successful Match
        const selectedFreelancerId = aiEstimateResult.selectedFreelancerId;
        console.log(`AI (${selectedModel}) selected freelancer: ${selectedFreelancerId}. Reasoning: ${aiEstimateResult.reasoning}`);

        // 7. Handle Project Assignment/Update (assignment occurs separately after client confirmation/payment)
        if (input.projectId) {
            console.log(`Project ${input.projectId} already exists, potential rematch logic needed or update existing project.`);
        } else {
            console.log(`Freelancer ${selectedFreelancerId} matched by ${selectedModel}. Project assignment needs to occur separately after client confirmation.`);
        }

        // 8. Return Success Output
        return {
            matchedFreelancerId: selectedFreelancerId,
            reasoning: aiEstimateResult.reasoning,
            estimatedBaseCost: estimatedBaseCost,
            platformFee: platformFee,
            totalCostToClient: totalCostToClient,
            estimatedTimeline: aiEstimateResult.estimatedTimeline,
            estimatedHours: aiEstimateResult.estimatedHours,
            extractedSkills: extractedSkills,
            status: 'matched',
        };

    } catch (error: any) {
        console.error(`Error during freelancer matching/estimation flow:`, error);
        // Check if the error message indicates an API key issue
        const isApiKeyError = error.message?.includes('API key');
        let errorMessage = isApiKeyError
            ? `An error occurred during matching: Invalid or missing API Key.`
            : `An error occurred during matching: ${error.message || 'Unknown error'}`;


        // Return fallback output with error details
        return {
            ...fallbackOutput,
            reasoning: errorMessage,
            extractedSkills: extractedSkills, // Keep extracted skills if available
            // Attempt to include partial estimations if available and valid
            estimatedTimeline: aiEstimateResult?.estimatedTimeline ?? 'N/A',
            estimatedHours: aiEstimateResult?.estimatedHours && aiEstimateResult.estimatedHours > 0 ? aiEstimateResult.estimatedHours : undefined,
            estimatedBaseCost: estimatedBaseCost > 0 ? estimatedBaseCost : undefined,
            platformFee: platformFee > 0 ? platformFee : undefined,
            totalCostToClient: totalCostToClient > 0 ? totalCostToClient : undefined,
       };
    }
}
