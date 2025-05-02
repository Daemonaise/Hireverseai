'use server';
/**
 * @fileOverview Generates freelance project ideas with cost estimation using AI.
 *
 * Exports:
 * - generateProjectIdea - Generates a project idea with cost breakdown.
 * - GenerateProjectIdeaInput - Input type (currently just optional industry hint).
 * - GenerateProjectIdeaOutput - Output type including cost details and status.
 */

import { ai } from '@/ai/ai-instance'; // Import the configured ai instance
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

// --- Helper: Extract JSON from potentially messy AI output ---
function extractJson(text: string): unknown | null {
    // Improved regex to handle potential markdown code blocks
    const match = text.match(/```json\s*([\s\S]*?)\s*```|(\{[\s\S]*\})/);
    if (match) {
        try {
            // Use the first capturing group if it exists (markdown block), otherwise use the second (raw JSON)
            const jsonString = match[1] ? match[1].trim() : match[2].trim();
            return JSON.parse(jsonString);
        } catch (e) {
            console.warn("JSON parsing failed:", e, "Raw Text:", text);
            return null;
        }
    }
    console.error("Could not find any JSON object in AI response:", text);
    return null;
}

// --- Define the Prompt ---
const projectIdeaPrompt = ai.definePrompt({
  name: 'generateProjectIdeaPrompt',
  input: { schema: GenerateProjectIdeaInputSchema },
  output: { schema: GenerateProjectIdeaAIOutputSchema }, // Expect AI to output in this format
  // Specify the model directly or rely on a default configured in `ai`
  // model: 'googleai/gemini-1.5-flash', // Example: Explicitly set model
  prompt: `CRITICAL: Your entire response MUST be ONLY a single, valid JSON object.
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

REMEMBER: ONLY the JSON object. Absolutely no other text before or after the JSON. Verify the structure and types carefully, especially 'estimatedHours' which must be a number >= 1.`,
});


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
    const randomNumber = Math.random().toFixed(4); // Generate random factor inside flow
    let aiResultData: GenerateProjectIdeaAIOutput;
    let reasoning = '';

    try {
      console.log("Generating project idea via prompt...");
      // Call the defined prompt with the input and the random number
      const { output } = await projectIdeaPrompt({ ...input, randomNumber });

      if (!output) {
          throw new Error("AI failed to return a valid output for project idea.");
      }
      // Validate the output against the AI schema
      const validationResult = GenerateProjectIdeaAIOutputSchema.safeParse(output);
        if (!validationResult.success) {
          // Provide detailed validation errors
          const errorDetails = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
          reasoning = `Invalid JSON structure received: ${errorDetails}`;
          throw new Error(reasoning);
        }
      aiResultData = validationResult.data;

      // Additional check for minimum hours (already in schema, but defense-in-depth)
      if (aiResultData.estimatedHours < 1) {
        console.warn(`AI returned estimated hours (${aiResultData.estimatedHours}) less than 1. Adjusting to 1.`);
        aiResultData.estimatedHours = 1;
        reasoning += " (Adjusted hours from minimal AI estimate)";
      }

    } catch (err: any) {
      console.error(`Error generating/validating idea JSON:`, err.message);
      reasoning = `Could not generate or validate AI response: ${err.message}.`;
      // Return structured error matching the output schema
      return {
        status: 'error',
        reasoning: reasoning,
        idea: 'Error',
        estimatedTimeline: 'N/A',
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
      reasoning: reasoning || `Generated idea. Est ${estimatedHours}h @ $${HOURLY_RATE}/h + ${PLATFORM_FEE * 100}% fee.`,
      status: 'success',
    };

    // Final validation of the complete output object (optional but good practice)
    try {
       GenerateProjectIdeaOutputSchema.parse(result);
    } catch (finalValidationError: any) {
         console.error("Final output validation failed:", finalValidationError);
         return {
             status: 'error',
             reasoning: `Internal validation failed after generation: ${finalValidationError.message}`,
             idea: 'Error',
             estimatedTimeline: 'N/A',
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
