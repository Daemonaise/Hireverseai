'use server';
/**
 * @fileOverview Match a freelancer to a project with skill extraction, estimation, and dynamic model selection via callAI.
 */

import { callAI } from '@/ai/ai-instance'; // Import the centralized callAI function
import { z } from 'zod';
import {
  MatchFreelancerInput,
  MatchFreelancerOutput,
  MatchFreelancerInputSchema,
  MatchFreelancerOutputSchema,
  ExtractSkillsAIOutputSchema, // Schema for AI skill extraction output
  EstimateAndSelectAIOutputSchema, // Schema for AI estimation output
} from '@/ai/schemas/match-freelancer-schema';
// No direct prompt definitions needed

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


// --- Helper: Extract JSON from potentially messy AI output ---
// Ensures robust parsing even if AI includes extra text.
function extractJson(text: string, expectedType: 'array' | 'object'): unknown | null {
    const pattern = expectedType === 'array' ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/;
    const match = text.match(pattern);
    if (match) {
        try {
            return JSON.parse(match[0]);
        } catch (e) {
            console.warn(`JSON parsing failed for expected ${expectedType}:`, e, "Raw Text:", text);
            return null;
        }
    }
    console.error(`Could not find any JSON ${expectedType} in AI response:`, text);
    return null;
}

// --- Main Exported Function ---
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
      // Ensure required fields are present even in error state, if schema demands it
      // estimatedHours: 0, // Example if required
    };
  }

  try {
    let skills = validatedInput.requiredSkills;
    let reasoningForSkills = ''; // Track reasoning for skill extraction

    // --- Skill Extraction (if needed) ---
    if (!skills || skills.length === 0) {
       console.log("No skills provided, extracting from brief...");

       const skillExtractionPromptText = `
Extract the top 1-5 most important freelancer skills from this project brief.
Respond ONLY as a JSON array of simple skill strings, like ["React", "Node.js"]. No explanations.

Project Brief:
${validatedInput.projectBrief}`;

      try {
        const responseText = await callAI(skillExtractionPromptText);
        const parsedJson = extractJson(responseText, 'array'); // Expect an array

        if (!parsedJson) throw new Error("AI failed to return a valid JSON array for skills.");

        // Validate the parsed JSON against the skill extraction schema
        const validationResult = ExtractSkillsAIOutputSchema.safeParse({ extractedSkills: parsedJson });
        if (!validationResult.success) {
            throw new Error(`Invalid skill structure: ${validationResult.error.errors.map(e => e.message).join(', ')}`);
        }

        skills = validationResult.data.extractedSkills;
        reasoningForSkills = 'Skills extracted by AI. '; // Add to overall reasoning
        console.log(`Extracted skills: ${skills.join(', ')}`);

      } catch (skillError: any) {
        console.error(`Failed to extract/validate skills:`, skillError.message);
        // If skill extraction fails, we cannot proceed effectively
        throw new Error(`Could not determine required skills from the project brief: ${skillError.message}`);
      }
    }

    // Ensure skills is an array before proceeding
    if (!Array.isArray(skills) || skills.length === 0) {
         throw new Error("Cannot proceed without required skills.");
    }


    // --- Estimation and Freelancer Selection ---
     console.log(`Estimating project with skills: ${skills.join(', ')}`);

     const estimationPromptText = `
You are an expert project estimator.

Given this project brief and skills, estimate realistic project completion time and optionally suggest a freelancer match (use ID if available).

Return ONLY JSON with:
{
  "selectedFreelancerId": "optional freelancer ID string or null",
  "reasoning": "concise explanation for estimate and match (string)",
  "estimatedHours": number (positive, realistic for US market, >= 0.1),
  "estimatedTimeline": "e.g., '2-3 days', 'about 1 week' (string)"
}
Ensure 'estimatedHours' is a positive number >= 0.1.

Project Brief:
${validatedInput.projectBrief}

Skills: ${skills.join(', ')}
`;

    let estimationResult: EstimateAndSelectAIOutput;
    try {
      const responseText = await callAI(estimationPromptText);
      const parsedJson = extractJson(responseText, 'object'); // Expect an object

      if (!parsedJson) throw new Error("AI failed to return a valid JSON object for estimation.");

       // Validate the estimation result structure
       const validationResult = EstimateAndSelectAIOutputSchema.safeParse(parsedJson);
       if (!validationResult.success) {
           throw new Error(`Invalid estimation structure: ${validationResult.error.errors.map(e => e.message).join(', ')}`);
       }
       estimationResult = validationResult.data; // Use validated data


      // Additional check for valid estimatedHours (schema ensures positive, but good defense)
      if (estimationResult.estimatedHours < 0.1) {
          console.warn(`AI returned estimated hours (${estimationResult.estimatedHours}) less than 0.1. Adjusting to 0.1.`);
          estimationResult.estimatedHours = 0.1; // Ensure minimum sensible value
          estimationResult.reasoning += " (Adjusted hours from minimal AI estimate)";
      }

    } catch (estimateError: any) {
      console.error(`Failed to get/validate estimation:`, estimateError.message);
      throw new Error(`Could not get a valid project estimate from AI: ${estimateError.message}`);
    }

    // Calculate costs based on the validated estimate
    const { estimatedBaseCost, platformFee, totalCostToClient } = calculateCosts(estimationResult.estimatedHours);

    // Determine the final status based on the estimation result
    const status: MatchFreelancerOutput['status'] = estimationResult.selectedFreelancerId
      ? 'matched'
      : 'no_available_freelancer'; // Or 'estimation_only' if freelancer matching wasn't attempted

    // Construct the final output object
    const outputResult: MatchFreelancerOutput = {
      // Add projectId if available from input or creation logic
      // projectId: validatedInput.projectId ?? undefined,
      matchedFreelancerId: estimationResult.selectedFreelancerId ?? undefined, // Handle null/undefined explicitly
      reasoning: reasoningForSkills + estimationResult.reasoning, // Combine reasoning
      estimatedBaseCost,
      platformFee,
      totalCostToClient,
      estimatedTimeline: estimationResult.estimatedTimeline,
      estimatedHours: estimationResult.estimatedHours,
      extractedSkills: skills, // Include the skills used
      status: status,
    };

    // Validate the final output against the schema before returning
    MatchFreelancerOutputSchema.parse(outputResult); // This will throw if invalid

    console.log(`Match process complete. Status: ${status}. Freelancer: ${outputResult.matchedFreelancerId ?? 'None'}`);
    return outputResult;

  } catch (error: any) {
    // Catch errors from skill extraction, estimation, or calculation
    console.error('Error during matchFreelancer flow:', error?.message ?? error);

    // Return an error state conforming to the output schema
    return {
      reasoning: `An error occurred during the matching process: ${error instanceof Error ? error.message : String(error)}`,
      status: 'error',
      // Ensure required fields are present if schema demands it
      // estimatedHours: 0, // Example
    };
  }
}
    
