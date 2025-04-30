'use server';
/**
 * @fileOverview Match a freelancer to a project with skill extraction, estimation, and AI dynamic model selection.
 */

import { callAI } from '@/ai/ai-instance';
import { chooseModelBasedOnPrompt } from '@/lib/model-selector';
import { z } from 'zod';
import {
  MatchFreelancerInput,
  MatchFreelancerOutput,
  MatchFreelancerInputSchema,
  MatchFreelancerOutputSchema,
  ExtractSkillsAIOutputSchema,
  EstimateAndSelectAIOutputSchema,
} from '@/ai/schemas/match-freelancer-schema';

// Export types separately
export type { MatchFreelancerInput, MatchFreelancerOutput };


// --- Constants ---
const PLATFORM_MARKUP_PERCENTAGE = 0.15;
const DEFAULT_HOURLY_RATE = 50;

// --- Helper Function ---
// Synchronous helper, keep internal or move to utils
function calculateCosts(hours: number): { estimatedBaseCost: number, platformFee: number, totalCostToClient: number } {
  const base = hours * DEFAULT_HOURLY_RATE;
  const fee = base * PLATFORM_MARKUP_PERCENTAGE;
  const total = base + fee;
  return {
    estimatedBaseCost: Number(base.toFixed(2)),
    platformFee: Number(fee.toFixed(2)),
    totalCostToClient: Number(total.toFixed(2)),
  };
}

// --- Main Exported Function ---
// Export only the async function
export async function matchFreelancer(input: MatchFreelancerInput): Promise<MatchFreelancerOutput> {
  let validatedInput: MatchFreelancerInput;
  try {
    // Validate the input against the schema
    validatedInput = MatchFreelancerInputSchema.parse(input);
  } catch (validationError: any) {
    console.error("Input validation failed for matchFreelancer:", validationError.errors ?? validationError);
    return {
      reasoning: `Invalid input provided: ${validationError.errors?.map((e: any) => e.message).join(', ') ?? 'Unknown validation error'}`,
      status: 'error',
    } as MatchFreelancerOutput; // Ensure return type matches schema
  }

  try {
    let skills = validatedInput.requiredSkills;

    // --- Skill Extraction (if needed) ---
    if (!skills || skills.length === 0) {
      const skillPrompt = `
Extract the top 1-5 most important freelancer skills from this project brief.
Respond ONLY as a JSON array of simple skill strings, like ["React", "Node.js"]. No explanations.

Project Brief: ${validatedInput.projectBrief}
`;

      // Determine model for skill extraction (uses centralized logic)
      const modelForSkillExtraction = chooseModelBasedOnPrompt(validatedInput.projectBrief);
      console.log(`Extracting skills using model: ${modelForSkillExtraction}`);

      // Use the centralized callAI function
      const skillResponse = await callAI('auto', skillPrompt); // Let model selector choose

      try {
        const cleanedSkillResponse = skillResponse.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        const parsedSkills = JSON.parse(cleanedSkillResponse);
        // Validate the extracted skills structure
        const validatedSkills = ExtractSkillsAIOutputSchema.parse({ extractedSkills: parsedSkills });
        skills = validatedSkills.extractedSkills;
      } catch (parseError: any) {
        console.error(`Failed to parse/validate extracted skills from AI (${modelForSkillExtraction}):`, parseError.errors ?? parseError, "Raw:", skillResponse);
        // If skill extraction fails, we cannot proceed effectively
        throw new Error("Could not determine required skills from the project brief.");
      }
    }

    // --- Estimation and Freelancer Selection ---
    const estimationPrompt = `
You are an expert project estimator.

Given this project brief and skills, estimate realistic project completion time and optionally suggest a freelancer match (use ID if available).

Return ONLY JSON with:
{
  "selectedFreelancerId": "optional freelancer ID or null",
  "reasoning": "concise explanation",
  "estimatedHours": number (positive, realistic US market),
  "estimatedTimeline": "e.g., '2-3 days', 'about 1 week'"
}
Ensure 'estimatedHours' is a positive number.

Project Brief: ${validatedInput.projectBrief}
Skills: ${skills.join(', ')}
`;

    // Determine model for estimation (uses centralized logic)
    const modelForEstimation = chooseModelBasedOnPrompt(validatedInput.projectBrief);
    console.log(`Estimating project using model: ${modelForEstimation}`);

    // Use the centralized callAI function
    const estimationResponse = await callAI('auto', estimationPrompt); // Let model selector choose

    let estimationResult: EstimateAndSelectAIOutput;
    try {
      const cleanedEstimationResponse = estimationResponse.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      const parsedEstimation = JSON.parse(cleanedEstimationResponse);
      // Validate the estimation result structure
      estimationResult = EstimateAndSelectAIOutputSchema.parse(parsedEstimation);

      // Additional check for valid estimatedHours
      if (estimationResult.estimatedHours <= 0) {
          console.warn(`AI (${modelForEstimation}) returned non-positive estimated hours (${estimationResult.estimatedHours}). Adjusting.`);
          // Set a default minimum or handle as an error, depending on requirements
          estimationResult.estimatedHours = 1; // Example: Default to 1 hour
          estimationResult.reasoning += " (Adjusted hours from non-positive AI estimate)";
      }

    } catch (parseError: any) {
      console.error(`Failed to parse/validate estimation from AI (${modelForEstimation}):`, parseError.errors ?? parseError, "Raw:", estimationResponse);
      throw new Error("Could not get a valid project estimate from AI.");
    }

    // Calculate costs based on the validated estimate
    const { estimatedBaseCost, platformFee, totalCostToClient } = calculateCosts(estimationResult.estimatedHours);

    // Determine the final status based on the estimation result
    const status: MatchFreelancerOutput['status'] = estimationResult.selectedFreelancerId
      ? 'matched'
      : 'no_available_freelancer'; // Or 'estimation_only' if freelancer matching wasn't attempted

    // Construct the final output object
    const output: MatchFreelancerOutput = {
      matchedFreelancerId: estimationResult.selectedFreelancerId ?? undefined, // Handle null/undefined
      reasoning: estimationResult.reasoning,
      estimatedBaseCost,
      platformFee,
      totalCostToClient,
      estimatedTimeline: estimationResult.estimatedTimeline,
      estimatedHours: estimationResult.estimatedHours,
      extractedSkills: skills, // Include the skills used for matching/estimation
      status: status,
    };

    // Validate the final output against the schema before returning (optional)
    // MatchFreelancerOutputSchema.parse(output);

    return output;

  } catch (error: any) {
    // Catch errors from skill extraction, estimation, or calculation
    console.error('Error during matchFreelancer flow:', error?.message ?? error);

    // Return an error state conforming to the output schema
    return {
      reasoning: `An error occurred during the matching process: ${error instanceof Error ? error.message : String(error)}`,
      status: 'error',
    } as MatchFreelancerOutput; // Ensure type consistency
  }
}
