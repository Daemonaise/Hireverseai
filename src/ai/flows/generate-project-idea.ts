
'use server';
/**
 * @fileOverview Generates freelance project ideas with cost estimation using AI.
 *
 * Exports:
 * - generateProjectIdea - Generates a project idea with cost breakdown.
 * - GenerateProjectIdeaInput - Input type (currently just optional industry hint).
 * - GenerateProjectIdeaOutput - Output type including cost details and status.
 */

import { ai } from '@/lib/ai'; // Import the configured ai instance
import { chooseModelBasedOnPrompt } from '@/lib/ai-server-helpers'; // Import model selector
import { validateAIOutput } from '@/ai/validate-output'; // Import from new location
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


// --- Define extended schema and inferred type ---
const PromptInputSchema = GenerateProjectIdeaInputSchema.extend({ randomNumber: z.string() });
type PromptInputType = z.infer<typeof PromptInputSchema>;


// --- Define the Flow ---
// This internal flow definition should NOT be exported directly if the file is marked 'use server'
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
    // Declare promptInput outside the try block using the inferred type
    let promptInput: PromptInputType | null = null;


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
          // Correctly use backticks for template literal
          name: `generateProjectIdeaPrompt_${primaryModel.replace(/[^a-zA-Z0-9]/g, '_')}`,
          model: primaryModel, // Explicitly specify the model here
          input: { schema: PromptInputSchema }, // Use the extended schema here
          output: { schema: GenerateProjectIdeaAIOutputSchema }, // Expect AI to output in this format
          prompt: projectIdeaPromptTemplate,
        });

        // 3. Call the defined prompt with the input and the random number
        promptInput = { ...input, randomNumber };

        console.log(`>>> Calling projectIdeaPrompt with input:`, JSON.stringify(promptInput));

        const { output: aiOutput } = await projectIdeaPrompt(promptInput); // <--- Error seems to occur here or inside

        if (!aiOutput) {
          throw new Error(`AI (${primaryModel}) returned null or undefined output.`);
        }

        console.log(`Raw AI Output (Attempt ${attempts}, Model: ${primaryModel}):`, JSON.stringify(aiOutput, null, 2));

        // 4. Validate the structured output against the AI schema
         rawResponse = JSON.stringify(aiOutput); // Store raw parsed output for logging on final failure

         const validationResult = GenerateProjectIdeaAIOutputSchema.safeParse(aiOutput);
         if (!validationResult.success) {
             const errorDetails = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
             lastError = `Invalid JSON structure received from ${primaryModel} (attempt ${attempts}): ${errorDetails}`;
             console.error(lastError, `Raw Output:`, rawResponse);
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
              // Corrected string replacement using template literals
              .replace(`{{#if industryHint}}Focus on the industry: '{{{industryHint}}}'.{{/if}}`, input.industryHint ? `Focus on the industry: '${input.industryHint}'.` : '');

         const validation = await validateAIOutput(originalPromptText, JSON.stringify(aiResultData), primaryModel); // Use validated data

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
        console.error(`Error during AI call or processing (attempt ${attempts}) for promptInput:`, JSON.stringify(promptInput)); // Log the input on error
        console.error(`Error details:`, err); // Log the full error object

        lastError = `Error during AI call or processing (attempt ${attempts}): ${err.message}`;
        console.error(lastError); // Keep original error log too
         rawResponse = err.message; // Store error message if AI call failed
        if (attempts === MAX_ATTEMPTS) {
           // Provide a more specific error based on the last failure
           let finalErrorMessage = `Failed to generate idea after ${MAX_ATTEMPTS} attempts.`;
           if (lastError?.includes("Invalid JSON structure")) {
                finalErrorMessage += ` Last error: Invalid AI response structure. Details: ${lastError}`;
           } else if (lastError?.includes("API key not valid")) {
               finalErrorMessage += ` Last error: Invalid API Key.`;
           } else if (lastError?.includes("cross-validation")) {
                finalErrorMessage += ` Last error: AI output failed cross-validation.`;
           } else {
               finalErrorMessage += ` Last error: ${lastError}.`;
           }
            console.error(finalErrorMessage, `Raw response/error:`, rawResponse);
            // Return error status to the client instead of throwing
             return {
               status: 'error',
               reasoning: finalErrorMessage,
               idea: 'Error',
               estimatedTimeline: 'N/A',
               requiredSkills: []
             };
        }
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait before retry
      }
    } // End of while loop

    if (!aiResultData) {
      // Should be caught by the throw inside the loop, but as a fallback
      const finalErrorMsg = `Could not generate a valid project idea after ${MAX_ATTEMPTS} attempts. Last error: ${lastError}. Raw Response: ${rawResponse || 'N/A'}`;
      console.error(finalErrorMsg);
      return {
        status: 'error',
        reasoning: finalErrorMsg,
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
         console.error(`Final output validation failed:`, finalValidationError);
         return {
             status: 'error',
             reasoning: `Internal validation failed after generation: ${finalValidationError.message}`,
             idea: 'Error',
             estimatedTimeline: 'N/A',
             requiredSkills: []
         };
    }

    console.log(`Successfully generated and validated project idea:`, result.idea);
    return result;
  }
);


// --- Main Exported Function (Wrapper) ---
// This is the function that can be called from the client/server
// It needs to be async because it calls the flow
export async function generateProjectIdea(
  input?: GenerateProjectIdeaInput // Accept optional input matching schema
): Promise<GenerateProjectIdeaOutput> {
  // Validate input before calling the flow
  const validatedInput = GenerateProjectIdeaInputSchema.parse(input ?? {});
  return generateProjectIdeaFlow(validatedInput);
}
