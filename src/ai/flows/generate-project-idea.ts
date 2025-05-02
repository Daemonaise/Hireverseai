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
    console.log("Attempting to extract JSON from raw AI text:", text); // Log the raw text FIRST
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
             console.warn("Strict JSON parsing failed:", e.message, "Raw Text:", text); // Log raw text on error
             // Fall through to relaxed match if strict parsing fails
        }
    } else {
         console.log("Strict JSON pattern not found in raw text.");
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
            console.error("Relaxed JSON parsing also failed:", e.message, "Raw Text:", text); // Log raw text on error
            return null; // Return null if relaxed also fails
        }
    }

    console.error("Could not find any JSON object in AI response. Raw Text:", text); // Log raw text if no JSON found
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

  // Construct the prompt for the callAI function with STRONGER instructions
  const promptText = `CRITICAL: Your entire response MUST be ONLY a single, valid JSON object.
Do NOT include ANY introductory text, concluding text, explanations, apologies, or markdown formatting like \`\`\`json.
Start the response immediately with '{' and end it immediately with '}'.

Generate a unique freelance project idea. Use this random number for inspiration: ${randomNumber.toFixed(4)}

Strictly follow this JSON structure:
{
  "idea": "string (short, catchy project title, non-empty)",
  "details": "string (detailed project description, non-empty, min 10 chars)",
  "estimatedTimeline": "string (e.g., '3-5 days', '1 week', non-empty)",
  "estimatedHours": number (must be >= 1),
  "requiredSkills": ["array of 1-5 skill strings (non-empty)"]
}
${params.industryHint ? `\nFocus on the industry: '${params.industryHint}'.` : ''}

REMEMBER: ONLY the JSON object. Absolutely no other text before or after the JSON. Verify the structure and types carefully.`;

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
          // Log the raw response when parsing fails
          lastErrorReason = `Could not parse JSON from AI response (attempt ${attempt}). Raw response logged above.`;
          console.warn(lastErrorReason);
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
    // Include the last known error reason in the final message
    const finalErrorMsg = `Failed to get valid JSON after ${MAX_RETRIES} attempts. Last error: ${lastErrorReason}`;
    console.error(finalErrorMsg);
    // Return a structured error that matches the expected output schema fields
    return {
      status: 'error',
      reasoning: finalErrorMsg,
      idea: 'Error', // Default value
      estimatedTimeline: 'N/A', // Default value
      // Add other fields with default values if needed by GenerateProjectIdeaOutputSchema
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
    const validationResult = GenerateProjectIdeaOutputSchema.safeParse(result);
     if (!validationResult.success) {
        // If final validation fails (e.g., due to calculation issues)
        console.error("Final output validation failed:", validationResult.error.errors);
        lastErrorReason = `Internal error processing AI response: ${validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
         return {
             status: 'error',
             reasoning: lastErrorReason,
             idea: 'Error',
             estimatedTimeline: 'N/A',
         };
     }
     const validatedResult = validationResult.data;
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
