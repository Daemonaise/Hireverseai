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

// Export types separately
export type { GenerateProjectIdeaOutput, GenerateProjectIdeaInput };

const PLATFORM_FEE_PERCENTAGE = 0.15;
const DEFAULT_HOURLY_RATE = 65;
const SUBSCRIPTION_MONTHS = 6; // Assuming a 6-month payment plan for subscription cost calculation

// --- Helper Functions ---
// These are synchronous helpers, keep internal or move to utils

function extractJsonFromText(text: string): any | null {
  // Improved JSON extraction (handles potential leading/trailing garbage)
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch (e){
    console.error("Failed to parse JSON from text:", e, "\nText:", text);
    return null;
  }
}

// --- Main Flow Function ---
// Export only the async function
export async function generateProjectIdea(input?: unknown): Promise<GenerateProjectIdeaOutput> {
  // Validate input if provided (using optional chaining and parse)
  let parsedInput: GenerateProjectIdeaInput | undefined;
  if (input) {
    try {
      parsedInput = GenerateProjectIdeaInputSchema.parse(input);
    } catch (validationError) {
      console.error("Input validation failed:", validationError);
      // Return error state conforming to output schema
      return {
        idea: '', details: '', estimatedTimeline: '', estimatedHours: undefined,
        estimatedBaseCost: undefined, platformFee: undefined, totalCostToClient: undefined,
        monthlySubscriptionCost: undefined, reasoning: 'Invalid input provided.', status: 'error', requiredSkills: []
      };
    }
  }

  try {
    // Use 'auto' to let the centralized selector choose the model
    const selectedModelType = 'auto';

    // **Strict JSON Prompt**
    const prompt = `
Generate a realistic freelance project idea.

**Output Requirements:**
Return ONLY a single, valid JSON object with the following keys and value types:
- "idea": string (non-empty, min 5 chars)
- "details": string (non-empty, brief description)
- "estimatedTimeline": string (non-empty, e.g., "3-5 days", "1-2 weeks")
- "estimatedHours": number (positive integer, e.g., 10, 40)
- "requiredSkills": array of strings (1-5 skills, e.g., ["React", "UI Design"])

${parsedInput?.industryHint ? `Industry Hint: ${parsedInput.industryHint}` : ''}

**Example JSON Output:**
{
  "idea": "Develop a Recipe Sharing Web App",
  "details": "A simple web application allowing users to post and discover recipes.",
  "estimatedTimeline": "2-3 weeks",
  "estimatedHours": 40,
  "requiredSkills": ["React", "Node.js", "Firebase", "UI Design"]
}

**Do not include any text, explanation, markdown formatting, or code block fences (like \`\`\`json) before or after the JSON object.**
`;

    console.log(`Generating project idea using ${selectedModelType}...`);
    // Use the centralized callAI function
    const responseString = await callAI(selectedModelType, prompt);

    // Check if callAI itself returned an operational error message
     if (responseString.startsWith("API key missing") || responseString.startsWith("AI generation error")) {
        console.error("AI call failed:", responseString);
        throw new Error(responseString); // Propagate the error message from callAI
     }

    console.log("Raw AI Response for project idea:", responseString);

    // Attempt to parse the response as JSON
    const parsedJSON = extractJsonFromText(responseString);

    if (!parsedJSON) {
       // Provide more context in the error message if JSON extraction failed
       throw new Error(`AI response did not contain valid JSON. Response received: ${responseString.substring(0, 100)}...`);
    }

    // Validate the parsed JSON against the AI output schema
    let validatedAIOutput: GenerateProjectIdeaAIOutput;
    try {
       // Use safeParse for better error handling within the Zod validation step
       const validationResult = GenerateProjectIdeaAIOutputSchema.safeParse(parsedJSON);
       if (!validationResult.success) {
            // Log detailed Zod errors
            console.error("Zod Validation Errors:", validationResult.error.errors);
            const errorDetails = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
            throw new Error(`AI response failed schema validation: ${errorDetails}. Raw JSON: ${JSON.stringify(parsedJSON)}`);
       }
       validatedAIOutput = validationResult.data;
    } catch (validationError) {
       // This catch block now primarily handles errors thrown *manually* from the try block above
        console.error("Validation error caught:", validationError);
        // Re-throw or handle as appropriate, ensuring the error message is informative
        throw new Error(`AI response validation failed. ${validationError instanceof Error ? validationError.message : String(validationError)}`);
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

    // Final validation of the complete output structure (optional but good practice)
    // GenerateProjectIdeaOutputSchema.parse(finalOutput);

    return finalOutput; // Return the successful result

  } catch (error: any) {
    console.error('Error in generateProjectIdea flow:', error?.message || error);
    // Provide a more specific error message in the reasoning field
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Return the error state conforming to the output schema
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
