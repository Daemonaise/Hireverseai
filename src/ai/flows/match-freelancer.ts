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

// --- Constants ---
const PLATFORM_MARKUP_PERCENTAGE = 0.15;
const DEFAULT_HOURLY_RATE = 50;

// --- Helper Function ---
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
export async function matchFreelancer(input: MatchFreelancerInput): Promise<MatchFreelancerOutput> {
  try {
    const validatedInput = MatchFreelancerInputSchema.parse(input);

    let skills = validatedInput.requiredSkills;

    if (!skills || skills.length === 0) {
      const skillPrompt = `
Extract the top 1-5 most important freelancer skills from this project brief. 
Respond ONLY as a JSON array of simple skill strings, no explanations.

Project Brief: ${validatedInput.projectBrief}
`;

      const modelForSkillExtraction = chooseModelBasedOnPrompt(validatedInput.projectBrief);
      const skillResponse = await callAI(modelForSkillExtraction, skillPrompt);

      const cleanedSkillResponse = skillResponse.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      const parsedSkills = JSON.parse(cleanedSkillResponse);
      const validatedSkills = ExtractSkillsAIOutputSchema.parse({ extractedSkills: parsedSkills });

      skills = validatedSkills.extractedSkills;
    }

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

Project Brief: ${validatedInput.projectBrief}
Skills: ${skills.join(', ')}
`;

    const modelForEstimation = chooseModelBasedOnPrompt(validatedInput.projectBrief);
    const estimationResponse = await callAI(modelForEstimation, estimationPrompt);

    const cleanedEstimationResponse = estimationResponse.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    const parsedEstimation = JSON.parse(cleanedEstimationResponse);
    const estimationResult = EstimateAndSelectAIOutputSchema.parse(parsedEstimation);

    const { estimatedBaseCost, platformFee, totalCostToClient } = calculateCosts(estimationResult.estimatedHours);

    const output: MatchFreelancerOutput = {
      matchedFreelancerId: estimationResult.selectedFreelancerId ?? undefined,
      reasoning: estimationResult.reasoning,
      estimatedBaseCost,
      platformFee,
      totalCostToClient,
      estimatedTimeline: estimationResult.estimatedTimeline,
      estimatedHours: estimationResult.estimatedHours,
      extractedSkills: skills,
      status: estimationResult.selectedFreelancerId ? 'matched' : 'no_available_freelancer',
    };

    return MatchFreelancerOutputSchema.parse(output);

  } catch (error: any) {
    console.error('Error during matchFreelancer flow:', error?.message ?? error);

    return {
      reasoning: 'An error occurred during the matching process.',
      status: 'error',
    } as MatchFreelancerOutput;
  }
}
export type { MatchFreelancerInput, MatchFreelancerOutput };
