
'use server';
/**
 * @fileOverview Generates freelance project ideas with cost estimation using AI.
 * Uses Genkit's built-in prompt definition and schema validation for reliable JSON output.
 *
 * Exports:
 * - generateProjectIdea - Generates a project idea with cost breakdown.
 * - GenerateProjectIdeaInput - Input type (currently just optional industry hint).
 * - GenerateProjectIdeaOutput - Output type including cost details and status.
 */

import { ai, chooseModelBasedOnPrompt } from '@/ai/ai-instance'; // Use the configured ai instance and model selector
import {
  GenerateProjectIdeaInputSchema,
  GenerateProjectIdeaAIOutputSchema, // Schema for the expected AI JSON output
  GenerateProjectIdeaOutputSchema, // Schema for the final flow output
  type GenerateProjectIdeaInput,
  type GenerateProjectIdeaOutput,
} from '@/ai/schemas/generate-project-idea-schema';
import { z } from 'zod';


// Export types separately
export type { GenerateProjectIdeaInput, GenerateProjectIdeaOutput };

// --- Constants ---
const PLATFORM_FEE         = 0.15; // 15%
const HOURLY_RATE          = 65;   // Example hourly rate in USD
const SUBSCRIPTION_MONTHS  = 6;    // Example subscription term


// --- Define the Genkit Prompt ---
const ideaGenerationPrompt = ai.definePrompt(
  {
    name: 'generateProjectIdeaPrompt', // Unique name for the prompt
    input: { schema: GenerateProjectIdeaInputSchema.extend({ randomNumber: z.string() }) }, // Add randomNumber to input schema
    output: { schema: GenerateProjectIdeaAIOutputSchema }, // Define the expected JSON output structure
    prompt: `CRITICAL: Your entire response MUST be ONLY a single, valid JSON object.
Do NOT include ANY introductory text, concluding text, explanations, apologies, or markdown formatting like \`\`\`json.
Start the response immediately with '{' and end it immediately with '}'.

Generate a unique freelance project idea based on the hint (if provided).
Use this random factor for inspiration: {{{randomNumber}}}

Strictly follow this JSON structure:
{
  "idea": "string (short, catchy project title, non-empty)",
  "details": "string (detailed project description, non-empty, min 10 chars)",
  "estimatedTimeline": "string (e.g., '3-5 days', '1 week', non-empty)",
  "estimatedHours": number (must be >= 0.1),
  "requiredSkills": ["array of 1-5 skill strings (non-empty)"]
}
{{#if industryHint}}
Focus on the industry: '{{industryHint}}'.
{{/if}}

REMEMBER: ONLY the JSON object. Absolutely no other text before or after the JSON. Verify the structure and types carefully, especially 'estimatedHours' which must be a number >= 0.1.`,
  }
);


// --- Main Exported Function ---
export async function generateProjectIdea(
  rawInput?: unknown // Accept optional raw input
): Promise<GenerateProjectIdeaOutput> {
  let inputData: GenerateProjectIdeaInput;
  let lastErrorReason = '';
  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount < maxRetries) {
    try {
      // Validate the input
      const parsedInput = GenerateProjectIdeaInputSchema.safeParse(rawInput ?? {});
      if (!parsedInput.success) {
        lastErrorReason = `Invalid input provided: ${parsedInput.error.errors.map(e => e.message).join(', ')}`;
        throw new Error(lastErrorReason);
      }
      inputData = parsedInput.data;

      // Generate a random number to encourage variability
      const randomNumber = Math.random().toFixed(4);

      // Choose model dynamically based on a simple hint or default
      const modelChoiceHint = inputData.industryHint || 'general project idea';
      const selectedModel = await chooseModelBasedOnPrompt(modelChoiceHint);
      console.log(`Generating project idea using model: ${selectedModel} (Attempt ${retryCount + 1})`);


      // Call the defined Genkit prompt, passing input and random number
      const { output: aiResultData } = await ideaGenerationPrompt(
        { ...inputData, randomNumber },
        { model: selectedModel } // Specify the chosen model
      );

      // Genkit handles the parsing based on the output schema.
      // If output is null or undefined, parsing/generation failed.
      if (!aiResultData) {
         lastErrorReason = `AI failed to generate a valid response matching the required schema (attempt ${retryCount + 1}).`;
         throw new Error(lastErrorReason);
      }

      // Basic validation (schema check already done by Genkit, but extra check for hours)
      if (aiResultData.estimatedHours < 0.1) {
          console.warn(`AI returned estimated hours (${aiResultData.estimatedHours}) less than 0.1. Adjusting to 0.1.`);
          aiResultData.estimatedHours = 0.1; // Ensure minimum sensible value
      }

      // --- Calculate Costs ---
      const { idea, details, estimatedTimeline, estimatedHours, requiredSkills } = aiResultData;
      const baseCost = estimatedHours * HOURLY_RATE;
      const platformFee = baseCost * PLATFORM_FEE;
      const totalCost = baseCost + platformFee;
      const monthlyCost = totalCost / SUBSCRIPTION_MONTHS;

      // --- Construct Final Output ---
      const result: GenerateProjectIdeaOutput = {
        idea,
        details,
        estimatedTimeline,
        estimatedHours,
        requiredSkills,
        estimatedBaseCost: Math.round(baseCost * 100) / 100,
        platformFee: Math.round(platformFee * 100) / 100,
        totalCostToClient: Math.round(totalCost * 100) / 100,
        monthlySubscriptionCost: Math.round(monthlyCost * 100) / 100,
        reasoning: `Generated idea using ${selectedModel}. Est ${estimatedHours}h @ $${HOURLY_RATE}/h + ${PLATFORM_FEE * 100}% fee.`,
        status: 'success',
      };

      // Final validation of the complete output object
      GenerateProjectIdeaOutputSchema.parse(result); // Use parse to throw on final validation failure

      console.log("Successfully generated and validated project idea:", result.idea);
      return result; // Success, exit the loop

    } catch (error: any) {
      retryCount++;
      console.error(`Error in generateProjectIdea flow (Attempt ${retryCount}):`, error?.message || error);

       // If it's a Zod validation error during input/output processing, format it
       if (error instanceof z.ZodError) {
          lastErrorReason = `Data validation error: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
       } else {
          lastErrorReason = error?.message || 'An unexpected error occurred during generation.';
       }

      if (retryCount >= maxRetries) {
          console.error(`Failed to generate valid idea after ${maxRetries} attempts.`);
          // Return a structured error matching the output schema
          return {
              status: 'error',
              reasoning: `Failed to get valid JSON after ${maxRetries} attempts. Last error: ${lastErrorReason}. Raw response logged above.`,
              idea: 'Error',
              estimatedTimeline: 'N/A',
          };
      }
       // Wait a bit before retrying (optional)
       // await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

   // Should not be reached if loop logic is correct, but provides a fallback error.
   return {
     status: 'error',
     reasoning: `Unexpected state: Failed after ${maxRetries} attempts without returning error object.`,
     idea: 'Error',
     estimatedTimeline: 'N/A',
   };
}
