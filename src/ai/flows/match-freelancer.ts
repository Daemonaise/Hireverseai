'use server';
/**
 * @fileOverview Match a freelancer to a project with skill extraction, estimation.
 */

import { ai } from '@/ai/ai-instance'; // Import the configured ai instance
import { z } from 'zod';
import {
  MatchFreelancerInput,
  MatchFreelancerOutput,
  MatchFreelancerInputSchema,
  MatchFreelancerOutputSchema,
  ExtractSkillsAIOutputSchema, // Schema for AI skill extraction output
  EstimateAndSelectAIOutputSchema, // Schema for AI estimation output
} from '@/ai/schemas/match-freelancer-schema';
import { updateProjectMicrotasks, updateProjectStatus } from '@/services/firestore'; // Keep if needed for project updates


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

// --- Define Prompts ---

// 1. Skill Extraction Prompt
const skillExtractionPrompt = ai.definePrompt({
  name: 'skillExtractionPrompt',
  input: { schema: z.object({ projectBrief: z.string().min(20) }) }, // Only needs the brief
  output: { schema: ExtractSkillsAIOutputSchema },
  // model: 'googleai/gemini-1.5-flash', // Example: Specify model
  prompt: `Extract the top 1-5 most important freelancer skills from this project brief.
Respond ONLY as a JSON object with the key "extractedSkills" containing an array of simple skill strings, like {"extractedSkills": ["React", "Node.js"]}. No explanations.

Project Brief:
{{{projectBrief}}}`,
});


// 2. Estimation and Selection Prompt
// Input requires brief and the extracted/provided skills
const EstimationInputSchema = z.object({
  projectBrief: z.string().min(20),
  requiredSkills: z.array(z.string()).min(1),
  // freelancerId: z.string().optional(), // Include if needed by prompt
});

const estimationPrompt = ai.definePrompt({
  name: 'estimationPrompt',
  input: { schema: EstimationInputSchema },
  output: { schema: EstimateAndSelectAIOutputSchema },
  // model: 'googleai/gemini-1.5-flash', // Example: Specify model
  prompt: `You are an expert project estimator.

Given this project brief and skills, estimate realistic project completion time and optionally suggest a freelancer match (use ID if available, simulate if needed).

Return ONLY JSON with:
{
  "selectedFreelancerId": "optional freelancer ID string or null",
  "reasoning": "concise explanation for estimate and match (string)",
  "estimatedHours": number (positive, realistic for US market, >= 0.1),
  "estimatedTimeline": "e.g., '2-3 days', 'about 1 week' (string)"
}
Ensure 'estimatedHours' is a positive number >= 0.1.

Project Brief:
{{{projectBrief}}}

Skills: {{#each requiredSkills}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
`,
});


// --- Define the Flow ---
const matchFreelancerFlow = ai.defineFlow<
  typeof MatchFreelancerInputSchema,
  typeof MatchFreelancerOutputSchema
>(
  {
    name: 'matchFreelancerFlow',
    inputSchema: MatchFreelancerInputSchema,
    outputSchema: MatchFreelancerOutputSchema,
  },
  async (input) => {
    let skills = input.requiredSkills;
    let reasoningForSkills = '';
    let projectId = input.projectId; // Use provided projectId or handle creation logic

    try {
      // --- Skill Extraction (if needed) ---
      if (!skills || skills.length === 0) {
        console.log("No skills provided, extracting from brief...");
        try {
          const { output: skillOutput } = await skillExtractionPrompt({ projectBrief: input.projectBrief });
          if (!skillOutput?.extractedSkills || skillOutput.extractedSkills.length === 0) {
            throw new Error("AI failed to return a valid array for skills.");
          }
          skills = skillOutput.extractedSkills;
          reasoningForSkills = 'Skills extracted by AI. ';
          console.log(`Extracted skills: ${skills.join(', ')}`);
        } catch (skillError: any) {
          console.error(`Failed to extract/validate skills:`, skillError.message);
          throw new Error(`Could not determine required skills: ${skillError.message}`);
        }
      }

      // Ensure skills is an array before proceeding
      if (!Array.isArray(skills) || skills.length === 0) {
        throw new Error("Cannot proceed without required skills.");
      }

      // --- Estimation and Freelancer Selection ---
      console.log(`Estimating project with skills: ${skills.join(', ')}`);
      let estimationResult: EstimateAndSelectAIOutput;
      try {
        const { output: estimationOutput } = await estimationPrompt({
          projectBrief: input.projectBrief,
          requiredSkills: skills,
          // freelancerId: input.freelancerId, // Pass if needed
        });

        if (!estimationOutput) {
            throw new Error("AI failed to return a valid JSON object for estimation.");
        }
        estimationResult = estimationOutput;

        // Additional check for valid estimatedHours
        if (estimationResult.estimatedHours < 0.1) {
          console.warn(`AI returned estimated hours (${estimationResult.estimatedHours}) less than 0.1. Adjusting to 0.1.`);
          estimationResult.estimatedHours = 0.1;
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
        : 'no_available_freelancer';

      // Construct the final output object
      const outputResult: MatchFreelancerOutput = {
        projectId: projectId, // Include projectId if available
        matchedFreelancerId: estimationResult.selectedFreelancerId ?? undefined,
        reasoning: reasoningForSkills + estimationResult.reasoning,
        estimatedBaseCost,
        platformFee,
        totalCostToClient,
        estimatedTimeline: estimationResult.estimatedTimeline,
        estimatedHours: estimationResult.estimatedHours,
        extractedSkills: skills,
        status: status,
      };

      // Validate the final output against the schema before returning
      MatchFreelancerOutputSchema.parse(outputResult);

      console.log(`Match process complete. Status: ${status}. Freelancer: ${outputResult.matchedFreelancerId ?? 'None'}`);
      return outputResult;

    } catch (error: any) {
      // Catch errors from skill extraction, estimation, or calculation
      console.error('Error during matchFreelancer flow:', error?.message ?? error);
      return {
        projectId: projectId, // Include projectId even in error state if known
        reasoning: `An error occurred during the matching process: ${error instanceof Error ? error.message : String(error)}`,
        status: 'error',
      };
    }
  }
);


// --- Main Exported Function (Wrapper) ---
export async function matchFreelancer(input: MatchFreelancerInput): Promise<MatchFreelancerOutput> {
  // Input validation handled by the flow
  MatchFreelancerInputSchema.parse(input);
  return matchFreelancerFlow(input);
}
