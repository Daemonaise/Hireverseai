'use server';
/**
 * @fileOverview Generates freelance project ideas with cost estimation using AI.
 *
 * Exports:
 * - generateProjectIdea - Generates a project idea with cost breakdown.
 * - GenerateProjectIdeaInput - Input type (currently just optional industry hint).
 * - GenerateProjectIdeaOutput - Output type including cost details and status.
 */

import { ai, chooseModelBasedOnPrompt } from '@/ai/ai-instance'; // Import the configured ai instance and helpers
import { z } from 'zod';
import {
  GenerateProjectIdeaInputSchema,
  GenerateProjectIdeaAIOutputSchema, // Schema for the expected AI JSON output
  GenerateProjectIdeaOutputSchema, // Schema for the final flow output
  type GenerateProjectIdeaInput,
  type GenerateProjectIdeaOutput,
} from '@/ai/schemas/generate-project-idea-schema';

// Export types separately
export type { GenerateProjectIdeaInput, GenerateProjectIdeaOutput };

// --- Constants ---
const PLATFORM_FEE         = 0.15; // 15%
const HOURLY_RATE          = 65;   // Example hourly rate in USD
const SUBSCRIPTION_MONTHS  = 6;    // Example subscription term

// --- Define the Prompt Template ---
const projectIdeaPromptTemplate = `CRITICAL: Your entire response MUST be ONLY a single, valid JSON object.
Do NOT include ANY introductory text, concluding text, explanations, apologies, or markdown formatting like \`\`\`json unless specifically requested by the schema.
Start the response immediately with '{' and end it immediately with '}'.

Generate a unique freelance project idea based on the hint (if provided).
Use this random factor for inspiration: {{{randomNumber}}}

Strictly follow this JSON structure:
{
  "idea": "string (short, catchy project title, non-empty)",
  "details": "string (detailed project description, non-empty, min 10 chars)",
  "estimatedTimeline": "string (e.g., '3-5 days', '1 week', non-empty)",
  "estimatedHours": number (must be >= 1),
  "requiredSkills": ["array of 1-5 skill strings (non-empty)"]
}
{{#if industryHint}}Focus on the industry: '{{{industryHint}}}'.{{/if}}

REMEMBER: ONLY the JSON object. Absolutely no other text before or after the JSON. Verify the structure and types carefully, especially 'estimatedHours' which must be a number >= 1.`;

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


// --- Define the Flow ---
const generateProjectIdeaFlow = ai.defineFlow<
  typeof GenerateProjectIdeaInputSchema,
  typeof GenerateProjectIdeaOutputSchema
>(
  {
    name: 'generateProjectIdeaFlow',
    inputSchema: GenerateProjectIdeaInputSchema,
    outputSchema: GenerateProjectIdeaOutputSchema,
  },
  async (input) => {
    const MAX_ATTEMPTS = 3;
    let attempts = 0;
    let aiResultData: z.infer<typeof GenerateProjectIdeaAIOutputSchema> | null = null;
    let lastError: string | null = null;
    let rawResponse: string | null = null;
    let primaryModel: string = ''; // Store the model used for generation

    while (attempts < MAX_ATTEMPTS && !aiResultData) {
      attempts++;
      console.log(`Generating project idea (attempt ${attempts})...`);
      const randomNumber = Math.random().toFixed(4); // Generate fresh random number each attempt
      lastError = null; // Reset error for this attempt

      try {
        // 1. Choose the primary model for generation
        const promptContext = `Generate project idea. Hint: ${input.industryHint || 'Any'}. Random: ${randomNumber}`;
        primaryModel = await chooseModelBasedOnPrompt(promptContext);
        console.log(`Using model ${primaryModel} for project idea generation (attempt ${attempts}).`);

        // 2. Define the prompt using the chosen model and template
        const projectIdeaPrompt = ai.definePrompt({
          name: `generateProjectIdeaPrompt_${primaryModel.replace(/[^a-zA-Z0-9]/g, '_')}`, // Dynamic name
          model: primaryModel, // Explicitly specify the model here
          input: { schema: GenerateProjectIdeaInputSchema.extend({ randomNumber: z.string() }) },
          output: { schema: GenerateProjectIdeaAIOutputSchema }, // Expect AI to output in this format
          prompt: projectIdeaPromptTemplate,
        });

        // 3. Call the defined prompt with the input and the random number
        const promptInput = { ...input, randomNumber };
        const { output: aiOutput } = await projectIdeaPrompt(promptInput);

        if (!aiOutput) {
          throw new Error(`AI (${primaryModel}) returned null or undefined output.`);
        }

        // 4. Validate the structured output against the AI schema
         console.log(`Raw AI Output (Attempt ${attempts}, Model: ${primaryModel}):`, JSON.stringify(aiOutput, null, 2));
         rawResponse = JSON.stringify(aiOutput); // Store raw parsed output for logging on final failure

         const validationResult = GenerateProjectIdeaAIOutputSchema.safeParse(aiOutput);
         if (!validationResult.success) {
             const errorDetails = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
             lastError = `Invalid JSON structure received from ${primaryModel} (attempt ${attempts}): ${errorDetails}`;
             console.error(lastError, "Raw Output:", rawResponse);
             if (attempts === MAX_ATTEMPTS) {
                throw new Error(`Failed to get valid JSON after ${MAX_ATTEMPTS} attempts. Last error: ${lastError}. Raw response logged above.`);
             }
             await new Promise(resolve => setTimeout(resolve, 500)); // Wait before retry
             continue; // Go to next attempt
         }

         aiResultData = validationResult.data; // Use the successfully parsed and validated data

         // Additional check for minimum hours
         if (aiResultData.estimatedHours < 1) {
             console.warn(`AI returned estimated hours (${aiResultData.estimatedHours}) less than 1. Adjusting to 1.`);
             aiResultData.estimatedHours = 1;
         }

         // 5. Validate the output with other models
          const originalPromptText = projectIdeaPromptTemplate
               .replace('{{{randomNumber}}}', randomNumber)
               .replace('{{#if industryHint}}Focus on the industry: \'{{{industryHint}}}\'.{{/if}}', input.industryHint ? `Focus on the industry: '${input.industryHint}'.` : '');

          const validation = await validateAIOutput(originalPromptText, JSON.stringify(aiOutput), primaryModel);

          if (!validation.allValid) {
              console.warn(`Validation failed for project idea generation (attempt ${attempts}). Reasoning:`, validation.results);
              lastError = `Project idea generation failed cross-validation (attempt ${attempts}).`;
              if (attempts === MAX_ATTEMPTS) {
                 throw new Error(lastError);
              }
              aiResultData = null; // Reset data to retry
              await new Promise(resolve => setTimeout(resolve, 500));
              continue;
          }


      } catch (err: any) {
        lastError = `Error during AI call or processing (attempt ${attempts}): ${err.message}`;
        console.error(lastError, err);
         rawResponse = err.message; // Store error message if AI call failed
        if (attempts === MAX_ATTEMPTS) {
           throw new Error(`Failed to get valid JSON after ${MAX_ATTEMPTS} attempts. Last error: ${lastError}. Raw response logged above.`);
        }
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait before retry
      }
    } // End of while loop

    if (!aiResultData) {
      // Should be caught by the throw inside the loop, but as a fallback
      console.error("Exited loop without valid AI data. Last error:", lastError);
      return {
        status: 'error',
        reasoning: `Could not generate a valid project idea after ${MAX_ATTEMPTS} attempts. Last error: ${lastError}. Raw Response: ${rawResponse || 'N/A'}`,
        idea: 'Error',
        estimatedTimeline: 'N/A',
        requiredSkills: []
      };
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
      reasoning: `Generated idea using ${primaryModel}. Est ${estimatedHours}h @ $${HOURLY_RATE}/h + ${PLATFORM_FEE * 100}% fee.`,
      status: 'success', // Set status to success
    };

    // Final validation of the complete output object
    try {
       GenerateProjectIdeaOutputSchema.parse(result);
    } catch (finalValidationError: any) {
         console.error("Final output validation failed:", finalValidationError);
         return {
             status: 'error',
             reasoning: `Internal validation failed after generation: ${finalValidationError.message}`,
             idea: 'Error',
             estimatedTimeline: 'N/A',
             requiredSkills: []
         };
    }

    console.log("Successfully generated and validated project idea:", result.idea);
    return result;
  }
);


// --- Main Exported Function (Wrapper) ---
export async function generateProjectIdea(
  input?: GenerateProjectIdeaInput // Accept optional input matching schema
): Promise<GenerateProjectIdeaOutput> {
  // Validate input before calling the flow
  const validatedInput = GenerateProjectIdeaInputSchema.parse(input ?? {});
  return generateProjectIdeaFlow(validatedInput);
}
