'use server';
/**
 * @fileOverview Match a freelancer to a project with skill extraction, estimation, and AI dynamic model selection.
 */

// Removed callAI import as it's no longer exported from ai-instance
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
import { ai } from '@/ai/ai-instance'; // Import the ai instance

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
       // Determine model for skill extraction (uses centralized logic)
       const modelForSkillExtraction = chooseModelBasedOnPrompt(validatedInput.projectBrief);
       console.log(`Extracting skills using model: ${modelForSkillExtraction}`);

       const skillPrompt = ai.definePrompt({
         name: 'extractSkillsPrompt',
         input: { schema: z.object({ projectBrief: z.string() }) },
         output: { schema: z.array(z.string()).describe("JSON array of simple skill strings") },
         model: modelForSkillExtraction, // Use the selected model
         prompt: `
Extract the top 1-5 most important freelancer skills from this project brief.
Respond ONLY as a JSON array of simple skill strings, like ["React", "Node.js"]. No explanations.

Project Brief: {{{projectBrief}}}
`,
       });

      try {
        const { output } = await skillPrompt({ projectBrief: validatedInput.projectBrief });
        if (!output || output.length === 0) {
           throw new Error("AI failed to extract any skills.");
        }
        // Validate the extracted skills structure
        const validatedSkills = ExtractSkillsAIOutputSchema.parse({ extractedSkills: output });
        skills = validatedSkills.extractedSkills;
      } catch (parseError: any) {
        console.error(`Failed to parse/validate extracted skills from AI (${modelForSkillExtraction}):`, parseError.errors ?? parseError, "Raw:", parseError); // Log raw if available
        // If skill extraction fails, we cannot proceed effectively
        throw new Error("Could not determine required skills from the project brief.");
      }
    }

    // --- Estimation and Freelancer Selection ---
     // Determine model for estimation (uses centralized logic)
     const modelForEstimation = chooseModelBasedOnPrompt(validatedInput.projectBrief);
     console.log(`Estimating project using model: ${modelForEstimation}`);

     const estimationPrompt = ai.definePrompt({
       name: 'estimateProjectPrompt',
       input: { schema: z.object({ projectBrief: z.string(), skills: z.array(z.string()) }) },
       output: { schema: EstimateAndSelectAIOutputSchema }, // Use the specific schema here
       model: modelForEstimation, // Use the selected model
       prompt: `
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

Project Brief: {{{projectBrief}}}
Skills: {{{skills.join(', ')}}}
`,
     });


    let estimationResult: EstimateAndSelectAIOutput;
    try {
      const { output } = await estimationPrompt({ projectBrief: validatedInput.projectBrief, skills });
      if (!output) {
         throw new Error(`AI (${modelForEstimation}) returned no estimation output.`);
      }

       // Validate the estimation result structure
       estimationResult = EstimateAndSelectAIOutputSchema.parse(output);

      // Additional check for valid estimatedHours
      if (estimationResult.estimatedHours <= 0) {
          console.warn(`AI (${modelForEstimation}) returned non-positive estimated hours (${estimationResult.estimatedHours}). Adjusting.`);
          // Set a default minimum or handle as an error, depending on requirements
          estimationResult.estimatedHours = 1; // Example: Default to 1 hour
          estimationResult.reasoning += " (Adjusted hours from non-positive AI estimate)";
      }

    } catch (parseError: any) {
      console.error(`Failed to parse/validate estimation from AI (${modelForEstimation}):`, parseError.errors ?? parseError, "Raw:", parseError); // Log raw if available
      throw new Error("Could not get a valid project estimate from AI.");
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
    MatchFreelancerOutputSchema.parse(outputResult); // This will throw if invalid

    return outputResult;

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
