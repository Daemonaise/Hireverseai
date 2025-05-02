'use server';
/**
 * @fileOverview Estimates the impact of a client's project change request on timeline and cost.
 *
 * Exports:
 * - estimateProjectChangeImpact - A function that handles the estimation process.
 */

import { ai, chooseModelBasedOnPrompt } from '@/ai/ai-instance'; // Import the configured ai instance and helpers
import { z } from 'zod';
import {
  RequestProjectChangeInputSchema,
  type RequestProjectChangeInput,
  RequestProjectChangeOutputSchema,
  type RequestProjectChangeOutput,
} from '@/ai/schemas/request-project-change-schema';

// Export types separately
export type { RequestProjectChangeInput, RequestProjectChangeOutput };

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

// --- Define the Prompt Template ---
const estimateChangePromptTemplate = `You are an AI Project Manager analyzing a change request for an ongoing project.

Project Details:
- ID: {{{projectId}}}
- Original Brief: {{{currentBrief}}}
- Original Skills: {{#each currentSkills}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
- Current Estimated Timeline: {{{currentTimeline}}}
- Current Estimated Cost: $${ RequestProjectChangeInputSchema.shape.currentCost.parse(0).toFixed(2) /* Placeholder formatting, adjust if needed */}

Change Request:
- Description: {{{changeDescription}}}
- Priority: {{{priority}}}

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


// --- Define the Flow ---
const estimateProjectChangeImpactFlow = ai.defineFlow<
  typeof RequestProjectChangeInputSchema,
  typeof RequestProjectChangeOutputSchema
>(
  {
    name: 'estimateProjectChangeImpactFlow',
    inputSchema: RequestProjectChangeInputSchema,
    outputSchema: RequestProjectChangeOutputSchema,
  },
  async (input) => {
    console.log(`Estimating project change impact for project ${input.projectId}...`);

    try {
        // 1. Choose the primary model for generation
        const promptContext = `Estimate impact of change: ${input.changeDescription} (Priority: ${input.priority}) on project: ${input.currentBrief}`;
        const primaryModel = await chooseModelBasedOnPrompt(promptContext);
        console.log(`Using model ${primaryModel} for change impact estimation.`);

        // 2. Define the prompt using the chosen model and template
        const estimateChangePrompt = ai.definePrompt({
            name: `estimateChangePrompt_${input.projectId}_${primaryModel.replace(/[^a-zA-Z0-9]/g, '_')}`, // Dynamic name
            input: { schema: RequestProjectChangeInputSchema },
            output: { schema: RequestProjectChangeOutputSchema },
            prompt: estimateChangePromptTemplate,
            model: primaryModel,
        });

      // 3. Call the defined prompt
      const { output: aiOutput } = await estimateChangePrompt(input);

      if (!aiOutput) {
        throw new Error(`AI (${primaryModel}) failed to return a valid JSON object for estimation.`);
      }

      // 4. Validate AI output structure (already done by prompt definition)
      // Additional defensive checks
      if (aiOutput.estimatedAdditionalCost < 0) {
        console.warn(`AI returned negative cost (${aiOutput.estimatedAdditionalCost}). Setting to 0.`);
        aiOutput.estimatedAdditionalCost = 0; // Correct negative cost
      }

       // 5. Validate the output with other models
       const originalPromptText = estimateChangePromptTemplate
         .replace('{{{projectId}}}', input.projectId)
         .replace('{{{currentBrief}}}', input.currentBrief)
         .replace('{{#each currentSkills}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}', input.currentSkills.join(', '))
         .replace('{{{currentTimeline}}}', input.currentTimeline)
         // Note: Cost formatting might need adjustment if schema parsing is strict
         .replace(`$${ RequestProjectChangeInputSchema.shape.currentCost.parse(0).toFixed(2) }`, `$${input.currentCost.toFixed(2)}`)
         .replace('{{{changeDescription}}}', input.changeDescription)
         .replace('{{{priority}}}', input.priority);

       const validation = await validateAIOutput(originalPromptText, JSON.stringify(aiOutput), primaryModel);

       if (!validation.allValid) {
           console.warn(`Validation failed for project change estimation ${input.projectId}. Reasoning:`, validation.results);
           // Optionally, retry or use fallback
           throw new Error(`Project change estimation for ${input.projectId} failed cross-validation.`);
       }

      console.log(`Successfully estimated and validated change for project ${input.projectId}: Timeline - ${aiOutput.estimatedNewTimeline}, Additional Cost - $${aiOutput.estimatedAdditionalCost}`);
      return aiOutput;

    } catch (error: any) {
      // Catch errors from AI call or parsing/validation
      console.error(`Error estimating project change impact for project ${input.projectId}:`, error?.message ?? error);
      // Propagate the error to the caller
      throw new Error(`Failed to estimate project change impact: ${error?.message ?? 'Unknown error'}`);
    }
  }
);

// --- Main Exported Function (Wrapper) ---
export async function estimateProjectChangeImpact(input: RequestProjectChangeInput): Promise<RequestProjectChangeOutput> {
  // Input validation handled by the flow
  RequestProjectChangeInputSchema.parse(input);
  return estimateProjectChangeImpactFlow(input);
}
