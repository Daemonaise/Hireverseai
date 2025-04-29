'use server';
/**
 * @fileOverview Generates a fresh project idea for clients, with real-world estimated costs.
 */

import { callAI } from '@/ai/ai-instance'; // Use the centralized helper
import {
  GenerateProjectIdeaInputSchema,
  GenerateProjectIdeaOutputSchema,
  GenerateProjectIdeaAIOutputSchema, // Use the raw AI output schema
  type GenerateProjectIdeaOutput,
  type GenerateProjectIdeaInput,
  type GenerateProjectIdeaAIOutput,
} from '@/ai/schemas/generate-project-idea-schema';
import { z } from 'zod'; // Import Zod

const PLATFORM_FEE_PERCENTAGE = 0.15;
const DEFAULT_HOURLY_RATE = 65;
const SUBSCRIPTION_MONTHS = 6; // Assuming a 6-month payment plan for subscription cost calculation


// --- Helper Functions (Removed extractIdeaFromText) ---

function extractJsonFromText(text: string): any | null {
  // Improved JSON extraction (handles potential leading/trailing garbage)
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

// --- Main Flow Function ---

export async function generateProjectIdea(input?: unknown): Promise<GenerateProjectIdeaOutput> {
  try {
    const parsedInput = input ? GenerateProjectIdeaInputSchema.parse(input) : undefined;
    const selectedModel = 'gemini'; // Hardcoded to Gemini as per previous instruction

    // **Strict JSON Prompt**
    const prompt = `
Generate a realistic freelance project idea.

**Output Requirements:**
Return ONLY a single, valid JSON object with the following keys and value types:
- "idea": string (non-empty, min 5 chars)
- "details": string (non-empty, brief description)
- "estimatedTimeline": string (non-empty, e.g., "3-5 days", "1-2 weeks")
- "estimatedHours": number (positive integer)
- "requiredSkills": array of strings (1-5 skills)

${parsedInput?.industryHint ? `Industry Hint: ${parsedInput.industryHint}` : ''}

**Example JSON Output:**
{
  "idea": "Develop a Recipe Sharing Web App",
  "details": "A simple web application allowing users to post and discover recipes.",
  "estimatedTimeline": "2-3 weeks",
  "estimatedHours": 40,
  "requiredSkills": ["React", "Node.js", "Firebase", "UI Design"]
}

**Do not include any text, explanation, or markdown before or after the JSON object.**
`;

    console.log("Generating project idea using Gemini...");
    const responseString = await callAI(selectedModel, prompt);
    console.log("Raw AI Response:", responseString);

    // Attempt to parse the response as JSON
    const parsedJSON = extractJsonFromText(responseString);

    if (!parsedJSON) {
       throw new Error(`AI response did not contain valid JSON. Response: ${responseString}`);
    }

    // Validate the parsed JSON against the AI output schema
    let validatedAIOutput: GenerateProjectIdeaAIOutput;
    try {
       validatedAIOutput = GenerateProjectIdeaAIOutputSchema.parse(parsedJSON);
    } catch (validationError) {
       if (validationError instanceof z.ZodError) {
          console.error("Zod Validation Errors:", validationError.errors);
          throw new Error(`AI response failed schema validation: ${validationError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}. Raw JSON: ${JSON.stringify(parsedJSON)}`);
       }
       throw new Error(`AI response validation failed. Raw JSON: ${JSON.stringify(parsedJSON)}`);
    }


    // Calculate costs based on validated AI output
    const estimatedBaseCost = validatedAIOutput.estimatedHours * DEFAULT_HOURLY_RATE;
    const platformFee = estimatedBaseCost * PLATFORM_FEE_PERCENTAGE;
    const totalCostToClient = estimatedBaseCost + platformFee;
    // Calculate monthly cost only if total cost is positive
    const monthlySubscriptionCost = totalCostToClient > 0 ? totalCostToClient / SUBSCRIPTION_MONTHS : 0;


    const finalOutput: GenerateProjectIdeaOutput = {
      idea: validatedAIOutput.idea,
      details: validatedAIOutput.details,
      estimatedTimeline: validatedAIOutput.estimatedTimeline,
      estimatedHours: validatedAIOutput.estimatedHours,
      requiredSkills: validatedAIOutput.requiredSkills ?? [], // Ensure array exists
      estimatedBaseCost: Math.round(estimatedBaseCost * 100) / 100,
      platformFee: Math.round(platformFee * 100) / 100,
      totalCostToClient: Math.round(totalCostToClient * 100) / 100,
      monthlySubscriptionCost: Math.round(monthlySubscriptionCost * 100) / 100,
      reasoning: `Calculated from ${validatedAIOutput.estimatedHours} hrs @ $${DEFAULT_HOURLY_RATE}/hr + ${PLATFORM_FEE_PERCENTAGE * 100}% fee`,
      status: 'success',
    };

    // Final validation of the complete output structure
    return GenerateProjectIdeaOutputSchema.parse(finalOutput);

  } catch (error: any) {
    console.error('Error in generateProjectIdea flow:', error?.message || error);
    // Provide a more specific error message in the reasoning field
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      idea: '',
      details: '',
      estimatedTimeline: '',
      estimatedHours: undefined,
      estimatedBaseCost: undefined,
      platformFee: undefined,
      totalCostToClient: undefined,
      monthlySubscriptionCost: undefined,
      reasoning: `Failed to generate or validate project idea: ${errorMessage}`, // More specific error
      status: 'error',
      requiredSkills: [],
    };
  }
}

export type { GenerateProjectIdeaOutput, GenerateProjectIdeaInput };
