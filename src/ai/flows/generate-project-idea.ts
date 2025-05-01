
'use server';
/**
 * @fileOverview Generates freelance project ideas with cost estimation using AI.
 *
 * Exports:
 * - generateProjectIdea - Generates a project idea with cost breakdown.
 * - GenerateProjectIdeaInput - Input type (currently just optional industry hint).
 * - GenerateProjectIdeaOutput - Output type including cost details and status.
 */

import { ai, chooseModelBasedOnPrompt } from '@/ai/ai-instance'; // Corrected import path
import {
  GenerateProjectIdeaInputSchema,
  GenerateProjectIdeaAIOutputSchema,
  GenerateProjectIdeaOutputSchema,
  type GenerateProjectIdeaInput,
  type GenerateProjectIdeaOutput,
} from '@/ai/schemas/generate-project-idea-schema';
import { z } from 'zod'; // Use standard zod import

// Export types separately
export type { GenerateProjectIdeaInput, GenerateProjectIdeaOutput };

// --- Constants ---
const PLATFORM_FEE         = 0.15; // 15%
const HOURLY_RATE          = 65;   // Example hourly rate in USD
const SUBSCRIPTION_MONTHS  = 6;    // Example subscription term
const MAX_RETRIES          = 3;    // Max attempts to get valid JSON

// --- Helper: Extract JSON from potentially messy AI output ---
function extractJson(text: string): unknown | null {
    const strictMatch = text.match(/\{[\s\S]*\}/); // Strict JSON object match
    if (strictMatch) {
        try {
            return JSON.parse(strictMatch[0]);
        } catch {
             console.warn("Strict JSON parsing failed, trying relaxed match.");
        }
    }
    // Relaxed match (handles cases where AI might add introductory text)
    const relaxedMatch = text.match(/\{(?:[^{}]|"(?:\\.|[^"\\])*")*\}/);
    if (relaxedMatch) {
        try {
            return JSON.parse(relaxedMatch[0]);
        } catch (e){
            console.error("Relaxed JSON parsing also failed:", e);
            return null;
        }
    }
    console.error("Could not find any JSON object in AI response:", text);
    return null;
}


// --- Helper: Call AI to generate idea ---
async function callGenerate(params: GenerateProjectIdeaInput, model: string): Promise<string> {
  // Construct the prompt for the AI
  const promptMessages = [
    {
      text:
        `Generate a single, valid JSON object representing a freelance project idea.

STRICTLY adhere to this structure:
{
  "idea": "Short, catchy project title (non-empty string)",
  "details": "Detailed description (non-empty string, min 10 chars)",
  "estimatedTimeline": "e.g., '3-5 days', '1 week' (non-empty string)",
  "estimatedHours": positive number (integer or float, must be >= 1),
  "requiredSkills": ["Array of 1-5 relevant skill strings (non-empty)"]
}
${params.industryHint ? `\nIndustry Hint: Focus on '${params.industryHint}'.` : ''}

Return ONLY the JSON object. No markdown, explanations, apologies, or other text outside the JSON structure. Ensure 'estimatedHours' is greater than or equal to 1.`
    },
  ];

  try {
    // Call the AI using the selected model
    const { text } = await ai.generate({
      model: model, // Pass the selected model ID here
      prompt: promptMessages,
      output: {
         format: 'json', // Request JSON format output
         schema: GenerateProjectIdeaAIOutputSchema, // Provide the schema for validation
      },
       // Add config if needed (e.g., temperature, max tokens)
       // config: { temperature: 0.7, maxOutputTokens: 512 },
    });
    return text;
  } catch (error: any) {
      console.error(`Error generating project idea using ${model}:`, error.message);
      // Return an error structure that the calling function can understand
      return JSON.stringify({ error: `Failed to generate idea using ${model}: ${error.message}` });
  }
}

// --- Main Exported Function ---
export async function generateProjectIdea(
  rawInput?: unknown // Accept optional raw input
): Promise<GenerateProjectIdeaOutput> {
  // Validate the input (even if it's empty/undefined)
  const parsedInput = GenerateProjectIdeaInputSchema.safeParse(rawInput ?? {});
  if (!parsedInput.success) {
    console.error("Invalid input for generateProjectIdea:", parsedInput.error.errors);
    return {
      status: 'error',
      reasoning: 'Invalid input provided to generateProjectIdea.',
      idea: 'Error', // Ensure required fields are present even in error state
      estimatedTimeline: 'N/A',
    };
  }
  const params = parsedInput.data;

  // Choose the model dynamically based on hint or general purpose
  const model = await chooseModelBasedOnPrompt(params.industryHint ?? 'generate project idea');
  console.log(`Using model: ${model} to generate project idea`);

  let aiText = '';
  let parsedJson: unknown | null = null;
  let lastErrorReason = '';

  // Retry loop to handle potential parsing issues
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`Attempt ${attempt} to generate project idea...`);
    aiText = await callGenerate(params, model);
    parsedJson = extractJson(aiText); // Attempt to parse JSON from the response

    // Check if the raw response indicates an API error from callGenerate
    if (typeof parsedJson === 'object' && parsedJson !== null && 'error' in parsedJson) {
        lastErrorReason = (parsedJson as { error: string }).error;
        console.error(`Attempt ${attempt} failed due to API error: ${lastErrorReason}`);
        parsedJson = null; // Reset parsedJson to trigger retry or final failure
        continue; // Try again
    }

    if (parsedJson) {
        // Validate the parsed JSON against the AI output schema
        const validationResult = GenerateProjectIdeaAIOutputSchema.safeParse(parsedJson);
        if (validationResult.success) {
           console.log(`Attempt ${attempt} successful. Valid JSON received.`);
           break; // Valid JSON obtained, exit loop
        } else {
           lastErrorReason = `Invalid JSON structure received from AI (attempt ${attempt}): ${validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
           console.warn(lastErrorReason, "Raw AI Text:", aiText);
           parsedJson = null; // Reset parsedJson to trigger retry
        }
    } else {
        lastErrorReason = `Could not parse JSON from AI response (attempt ${attempt}).`;
        console.warn(lastErrorReason, "Raw AI Text:", aiText);
    }

    if (attempt < MAX_RETRIES) {
       await new Promise(resolve => setTimeout(resolve, 500)); // Wait before retrying
    }
  }

  // Handle failure after all retries
  if (!parsedJson) {
    console.error(`Failed to get valid JSON after ${MAX_RETRIES} attempts.`);
    return {
      status: 'error',
      reasoning: lastErrorReason || `Could not parse valid JSON from AI after ${MAX_RETRIES} attempts.`,
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
    const monthlyCost = totalCost / SUBSCRIPTION_MONTHS; // Example, adjust if needed

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
      reasoning: `Generated using ${model}. ${estimatedHours}h @ $${HOURLY_RATE}/h + ${PLATFORM_FEE * 100}% fee.`,
      status: 'success',
    };

    // Final validation of the complete output object (optional but recommended)
    const validatedResult = GenerateProjectIdeaOutputSchema.parse(result);
    console.log("Final Output:", validatedResult);
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
