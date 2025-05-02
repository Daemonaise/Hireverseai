'use server';
/**
 * @fileOverview Generates freelance project ideas with cost estimation using AI.
 *
 * Exports:
 * - generateProjectIdea - Generates a project idea with cost breakdown.
 * - GenerateProjectIdeaInput - Input type (currently just optional industry hint).
 * - GenerateProjectIdeaOutput - Output type including cost details and status.
 */

import { callAI } from '@/ai/ai-instance'; // Use the centralized callAI function
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
const MAX_RETRIES          = 3;    // Max attempts to get valid JSON

// --- Helper: Extract JSON from potentially messy AI output ---
function extractJson(text: string): unknown | null {
    console.log("Attempting to extract JSON from text:", text); // Log the raw text
    // Prioritize strict JSON object match first
    // Look for text starting with '{' and ending with '}', potentially with surrounding whitespace
    const strictMatch = text.match(/^\s*(\{[\s\S]*\})\s*$/);
    if (strictMatch) {
        try {
            // Test if it's valid JSON
            const parsed = JSON.parse(strictMatch[1]);
            console.log("Strict JSON parsing successful.");
            return parsed;
        } catch (e: any) {
             console.warn("Strict JSON parsing failed:", e.message);
             // Fall through to relaxed match if strict parsing fails
        }
    } else {
         console.log("Strict JSON pattern not found.");
    }

    // Relaxed match (handles cases with leading/trailing text, more greedy)
    // Finds the first '{' and the last '}'
    const relaxedMatch = text.match(/\{[\s\S]*\}/);
    if (relaxedMatch) {
         console.log("Trying relaxed JSON match...");
        try {
            const parsed = JSON.parse(relaxedMatch[0]);
            console.log("Relaxed JSON parsing successful.");
            return parsed;
        } catch (e: any){
            console.error("Relaxed JSON parsing also failed:", e.message);
            return null; // Return null if relaxed also fails
        }
    }

    console.error("Could not find any JSON object in AI response.");
    return null; // Return null if no JSON object is found
}


// --- Main Exported Function ---
export async function generateProjectIdea(
  rawInput?: unknown // Accept optional raw input
): Promise<GenerateProjectIdeaOutput> {
  // Validate the input
  const parsedInput = GenerateProjectIdeaInputSchema.safeParse(rawInput ?? {});
  if (!parsedInput.success) {
    console.error("Invalid input for generateProjectIdea:", parsedInput.error.errors);
    return {
      status: 'error',
      reasoning: 'Invalid input provided.',
      idea: 'Error',
      estimatedTimeline: 'N/A',
    };
  }
  const params = parsedInput.data;

  // Use a random number as part of the prompt to encourage variability
  const randomNumber = Math.random();

  // Construct the prompt for the callAI function
  const promptText = `Generate a single, valid JSON object representing a freelance project idea.

**Critically important:** Your entire response must be ONLY the JSON object itself. Do NOT include any introductory text, markdown formatting (like \`\`\`json), explanations, apologies, or any characters before the opening '{' or after the closing '}'.

To ensure varied results, use this random number as inspiration: ${randomNumber.toFixed(4)}

Strictly adhere to this structure, ensuring all fields are present and correctly typed:
{
  "idea": "Short, catchy project title (string, non-empty)",
  "details": "Detailed description of the project (string, non-empty, min 10 chars)",
  "estimatedTimeline": "Estimated duration, e.g., '3-5 days', '1 week' (string, non-empty)",
  "estimatedHours": A number representing estimated hours (must be >= 1),
  "requiredSkills": ["Array of 1-5 relevant skill strings (non-empty)"]
}
${params.industryHint ? `\nIndustry Hint: Focus on '${params.industryHint}'.` : ''}

Remember: ONLY the JSON object. No extra text whatsoever. Double-check the structure and types before responding.`;

  let aiText = '';
  let parsedJson: unknown | null = null;
  let lastErrorReason = '';

  // Retry loop to handle potential parsing/validation issues
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`Attempt ${attempt} to generate project idea...`);
    try {
      // Call the centralized AI function
      aiText = await callAI(promptText); // callAI handles model selection and primary call
      console.log(`[Attempt ${attempt}] Raw AI Response Text:\n--- START ---\n${aiText}\n--- END ---`); // Log the full raw response
      parsedJson = extractJson(aiText); // Attempt to parse JSON from the response

      if (parsedJson) {
          // Validate the parsed JSON against the AI output schema
          const validationResult = GenerateProjectIdeaAIOutputSchema.safeParse(parsedJson);
          if (validationResult.success) {
             console.log(`Attempt ${attempt} successful. Valid JSON received and validated.`);
             parsedJson = validationResult.data; // Use the validated data
             break; // Valid JSON obtained, exit loop
          } else {
             // Log the specific validation errors
             lastErrorReason = `Invalid JSON structure received (attempt ${attempt}): ${validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
             console.warn(lastErrorReason, "Parsed JSON Object:", parsedJson);
             parsedJson = null; // Reset parsedJson to trigger retry
          }
      } else {
          lastErrorReason = `Could not parse JSON from AI response (attempt ${attempt}).`;
          console.warn(lastErrorReason); // Raw text logged above
      }
    } catch (aiError: any) {
        // Catch errors from callAI itself (e.g., network issues, API errors)
        lastErrorReason = `AI call failed (attempt ${attempt}): ${aiError.message}`;
        console.error(lastErrorReason);
        parsedJson = null; // Reset to trigger retry
    }


    if (attempt < MAX_RETRIES && !parsedJson) {
       await new Promise(resolve => setTimeout(resolve, 500 * attempt)); // Wait longer before retrying
    }
  }

  // Handle failure after all retries
  if (!parsedJson) {
    const finalErrorMsg = `Failed to get valid JSON after ${MAX_RETRIES} attempts. Last error: ${lastErrorReason}`;
    console.error(finalErrorMsg);
    return {
      status: 'error',
      reasoning: finalErrorMsg,
      idea: 'Error',
      estimatedTimeline: 'N/A',
    };
  }

  // We have valid parsed JSON matching the AI Output Schema now
  const aiResultData = parsedJson as z.infer<typeof GenerateProjectIdeaAIOutputSchema>;

  try {
    // Calculate costs based on the estimated hours
    const { idea, details, estimatedTimeline, estimatedHours, requiredSkills } = aiResultData;
    const baseCost = estimatedHours * HOURLY_RATE;
    const platformFee = baseCost * PLATFORM_FEE;
    const totalCost = baseCost + platformFee;
    const monthlyCost = totalCost / SUBSCRIPTION_MONTHS;

    // Construct the final success output
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
      reasoning: `Generated idea. Estimated ${estimatedHours}h @ $${HOURLY_RATE}/h + ${PLATFORM_FEE * 100}% fee.`,
      status: 'success',
    };

    // Final validation of the complete output object
    const validatedResult = GenerateProjectIdeaOutputSchema.parse(result);
    console.log("Successfully generated and validated project idea:", validatedResult.idea);
    return validatedResult;

  } catch (processingError: any) {
    console.error("Error processing valid AI response or final validation:", processingError);
    // If it's a Zod validation error, format it nicely
    if (processingError instanceof z.ZodError) {
        lastErrorReason = `Internal error processing AI response: ${processingError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
    } else {
        lastErrorReason = `Internal error processing AI response: ${processingError.message}`;
    }
    return {
        status: 'error',
        reasoning: lastErrorReason,
        idea: 'Error',
        estimatedTimeline: 'N/A',
    };
  }
}