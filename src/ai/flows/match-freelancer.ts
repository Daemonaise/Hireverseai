'use server';
/**
 * @fileOverview Match a freelancer to a project with skill extraction, estimation.
 */

import { ai, chooseModelBasedOnPrompt } from '@/ai/ai-instance'; // Import the configured ai instance and helpers
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

// --- Cross-Validation Logic (Included within the flow file) ---
const ValidationSchema = z.object({
  isValid: z.boolean().describe("Whether the original output is valid and accurate based on the original request."),
  reasoning: z.string().optional().describe("Explanation if invalid, or brief confirmation if valid."),
});
type ValidationResult = z.infer<typeof ValidationSchema>;

async function validateAIOutput(
  originalPrompt: string,
  originalOutput: string,
  primaryModelName: string
): Promise<{ allValid: boolean; results: ValidationResult[] }> {
  const validatorModels: string[] = [];
  const availableModels = {
    google: 'googleai/gemini-1.5-flash',
    openai: ['openai/gpt-4o-mini', 'openai/gpt-4o'],
    anthropic: ['anthropic/claude-3-haiku-20240307', 'anthropic/claude-3-5-sonnet-20240620']
  };

  // Re-read env vars inside this function to ensure up-to-date checks
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  if (GOOGLE_API_KEY && primaryModelName !== availableModels.google) validatorModels.push(availableModels.google);
  // Prefer cheaper models for validation if available
  if (OPENAI_API_KEY && !primaryModelName.startsWith('openai/')) validatorModels.push(availableModels.openai[0]);
  if (ANTHROPIC_API_KEY && !primaryModelName.startsWith('anthropic/')) validatorModels.push(availableModels.anthropic[0]);

  if (validatorModels.length === 0) {
    console.warn("[AI Validation] No other models available for cross-validation. Skipping.");
    return { allValid: true, results: [] }; // Assume valid if no validators
  }

  console.log(`[AI Validation] Validating output from ${primaryModelName} using models: ${validatorModels.join(', ')}`);

  const validationPrompt = `You are an AI evaluator. Assess if the following AI output accurately and completely fulfills the original request.
Return ONLY a JSON object with keys "isValid" (boolean) and "reasoning" (string, explanation if invalid, brief confirmation if valid).

=== Original Request ===
${originalPrompt}

=== AI Output to Validate ===
${originalOutput}

=== Evaluation ===
Does the output strictly follow the requested format (if any) and address all parts of the original request accurately?
Is the output sensible and relevant to the request?
Respond ONLY with the JSON object: {"isValid": boolean, "reasoning": string}`;

  const validationResults: ValidationResult[] = [];
  let allValid = true;

  for (const modelName of validatorModels) {
    try {
      const validationAI = ai.defineModel({
          name: `validationModel_${modelName.replace(/[^a-zA-Z0-9]/g, '_')}`,
          model: modelName,
          output: { schema: ValidationSchema }, // Ensure the model tries to output in the correct format
      });

      const { output } = await validationAI.generate({
        prompt: validationPrompt,
        output: { schema: ValidationSchema } // Reiterate schema for clarity
      });

      if (output) {
        const parsedOutput = ValidationSchema.parse(output); // Validate the structure
        validationResults.push(parsedOutput);
        if (!parsedOutput.isValid) {
          allValid = false;
        }
         console.log(`[AI Validation] Validator ${modelName} result: isValid=${parsedOutput.isValid}`);
      } else {
        console.warn(`[AI Validation] Validator ${modelName} returned empty or invalid output.`);
        validationResults.push({ isValid: false, reasoning: `Validator ${modelName} failed to provide valid JSON.` });
        allValid = false; // Treat empty output as failure
      }
    } catch (error: any) {
      console.error(`[AI Validation] Error validating with ${modelName}:`, error.message);
      validationResults.push({ isValid: false, reasoning: `Error during validation with ${modelName}: ${error.message}` });
      allValid = false; // Treat error as failure
    }
  }

  console.log(`[AI Validation] Final validation result: allValid=${allValid}`);
  return { allValid, results: validationResults };
}
// --- End Cross-Validation Logic ---


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

// --- Define Prompt Templates ---

// 1. Skill Extraction Prompt Template
const skillExtractionPromptTemplate = `Extract the top 1-5 most important freelancer skills from this project brief.
Respond ONLY as a JSON object with the key "extractedSkills" containing an array of simple skill strings, like {"extractedSkills": ["React", "Node.js"]}. No explanations.

Project Brief:
{{{projectBrief}}}`;


// 2. Estimation and Selection Prompt Template
// Input requires brief and the extracted/provided skills
const EstimationInputSchema = z.object({
  projectBrief: z.string().min(20),
  requiredSkills: z.array(z.string()).min(1),
  // freelancerId: z.string().optional(), // Include if needed by prompt
});

const estimationPromptTemplate = `You are an expert project estimator.

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
`;


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
        let skillExtractionModel: string;
        let skillOutput: ExtractSkillsAIOutput | null = null;
        try {
          // 1a. Choose model for skill extraction
          skillExtractionModel = await chooseModelBasedOnPrompt(`Extract skills from: ${input.projectBrief}`);
          console.log(`Using model ${skillExtractionModel} for skill extraction.`);

          // 1b. Define skill extraction prompt
          const skillExtractionPrompt = ai.definePrompt({
              name: `skillExtractionPrompt_${skillExtractionModel.replace(/[^a-zA-Z0-9]/g, '_')}`,
              input: { schema: z.object({ projectBrief: z.string().min(20) }) },
              output: { schema: ExtractSkillsAIOutputSchema },
              prompt: skillExtractionPromptTemplate,
              model: skillExtractionModel,
          });

          // 1c. Call skill extraction prompt
          const { output } = await skillExtractionPrompt({ projectBrief: input.projectBrief });
          if (!output?.extractedSkills || output.extractedSkills.length === 0) {
            throw new Error(`AI (${skillExtractionModel}) failed to return a valid array for skills.`);
          }
          skillOutput = output;

          // 1d. Validate the output with other models
          const originalPromptText = skillExtractionPromptTemplate.replace('{{{projectBrief}}}', input.projectBrief);
          const validation = await validateAIOutput(originalPromptText, JSON.stringify(skillOutput), skillExtractionModel);

          if (!validation.allValid) {
              console.warn(`Validation failed for skill extraction. Reasoning:`, validation.results);
              throw new Error(`Skill extraction failed cross-validation.`);
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
      let estimationModel: string;
      try {
        // 2a. Choose model for estimation
        estimationModel = await chooseModelBasedOnPrompt(`Estimate project: ${input.projectBrief} Skills: ${skills.join(', ')}`);
        console.log(`Using model ${estimationModel} for estimation.`);

        // 2b. Define estimation prompt
        const estimationPrompt = ai.definePrompt({
            name: `estimationPrompt_${estimationModel.replace(/[^a-zA-Z0-9]/g, '_')}`,
            input: { schema: EstimationInputSchema },
            output: { schema: EstimateAndSelectAIOutputSchema },
            prompt: estimationPromptTemplate,
            model: estimationModel,
        });

        // 2c. Call estimation prompt
        const estimationInput = {
          projectBrief: input.projectBrief,
          requiredSkills: skills,
          // freelancerId: input.freelancerId, // Pass if needed
        };
        const { output: estimationOutput } = await estimationPrompt(estimationInput);

        if (!estimationOutput) {
            throw new Error(`AI (${estimationModel}) failed to return a valid JSON object for estimation.`);
        }
        estimationResult = estimationOutput;

        // Additional check for valid estimatedHours
        if (estimationResult.estimatedHours < 0.1) {
          console.warn(`AI returned estimated hours (${estimationResult.estimatedHours}) less than 0.1. Adjusting to 0.1.`);
          estimationResult.estimatedHours = 0.1;
          estimationResult.reasoning += " (Adjusted hours from minimal AI estimate)";
        }

         // 2d. Validate the output with other models
         const originalPromptText = estimationPromptTemplate
              .replace('{{{projectBrief}}}', input.projectBrief)
              .replace('{{#each requiredSkills}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}', skills.join(', '));

         const validation = await validateAIOutput(originalPromptText, JSON.stringify(estimationResult), estimationModel);

          if (!validation.allValid) {
              console.warn(`Validation failed for project estimation. Reasoning:`, validation.results);
              throw new Error(`Project estimation failed cross-validation.`);
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
