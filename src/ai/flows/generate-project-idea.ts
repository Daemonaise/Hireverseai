'use server';

/**
 * generate-project-idea.ts
 *
 * Uses your Genkit AI instance to generate a realistic freelance project idea,
 * parses and validates the JSON output, then adds cost estimates.
 */

import { ai, chooseModelBasedOnPrompt } from '@/ai/ai-instance'; // Import ai instance and model selector
import {
  GenerateProjectIdeaInputSchema,
  GenerateProjectIdeaAIOutputSchema,
  GenerateProjectIdeaOutputSchema,
  type GenerateProjectIdeaInput,
  type GenerateProjectIdeaAIOutput,
  type GenerateProjectIdeaOutput,
} from '@/ai/schemas/generate-project-idea-schema';
import { z } from 'zod';

// ─── Constants ────────────────────────────────────────────────────────────────
const PLATFORM_FEE_PERCENTAGE = 0.15;
const DEFAULT_HOURLY_RATE     = 65;
const SUBSCRIPTION_MONTHS     = 6;

// ─── JSON Extraction Helper ────────────────────────────────────────────────────
function extractJsonFromText(text: string): any | null {
  // Attempt to find JSON starting with '{' and ending with '}'
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
      // Fallback: Try finding JSON that might be embedded without strict start/end
      // This is less reliable and might need refinement based on actual AI outputs
      const relaxedMatch = text.match(/\{(?:[^{}]|"(?:\\.|[^"\\])*")*\}/);
      if (!relaxedMatch) return null;
       try {
         return JSON.parse(relaxedMatch[0]);
       } catch (e) {
         console.warn('[ProjectIdea] Relaxed JSON parse attempt failed:', e);
         return null;
       }
  }
  try {
    return JSON.parse(match[0]);
  } catch (e) {
    console.error('[ProjectIdea] JSON parse error:', e, '\nText:', text);
    return null;
  }
}

// ─── Prompt Definition ─────────────────────────────────────────────────────────
const generateIdeaPrompt = ai.definePrompt({
  name: 'generateProjectIdea',
  // Model will be selected dynamically in the main function
  input: { schema: z.object({ industryHint: z.string().optional() }) },
  output: { schema: GenerateProjectIdeaAIOutputSchema }, // Expect AI to return structured JSON directly matching this schema
  prompt: ({ industryHint }) => `
Generate a single, valid JSON object representing a freelance project idea.

STRICTLY adhere to this JSON structure:
{
  "idea": "Short, catchy project title (string, min 1 char)",
  "details": "Detailed description of the project (string, min 1 char)",
  "estimatedTimeline": "Realistic timeline (string, e.g., '3-5 days', min 1 char)",
  "estimatedHours": "Positive integer number of hours (number, > 0)",
  "requiredSkills": ["Array of 1-5 relevant skill strings (string[], min 1 item, max 5 items)"]
}

${industryHint ? `Industry Hint: Focus on projects related to '${industryHint}'.` : ''}

CRITICAL: Ensure 'estimatedHours' is a positive integer. Ensure 'requiredSkills' has between 1 and 5 strings.
Return ONLY the valid JSON object. No introductory text, no explanations, no markdown formatting.
`,
});

// ─── Main Function ─────────────────────────────────────────────────────────────
/**
 * Generates, validates, and augments a project idea.
 */
export async function generateProjectIdea(
  input?: unknown
): Promise<GenerateProjectIdeaOutput> {
  let params: GenerateProjectIdeaInput | undefined;
  if (input) {
    const result = GenerateProjectIdeaInputSchema.safeParse(input);
    if (!result.success) {
      const errorReason = result.error.format()._errors?.join(', ') ?? 'Invalid input provided.';
      console.error('[ProjectIdea] Input validation failed:', result.error.format());
      // Ensure the error object adheres to the schema, including status
      return {
        idea: 'Error',
        details: undefined,
        estimatedTimeline: 'N/A',
        estimatedHours: undefined,
        estimatedBaseCost: undefined,
        platformFee: undefined,
        totalCostToClient: undefined,
        monthlySubscriptionCost: undefined,
        requiredSkills: undefined,
        reasoning: `Invalid input: ${errorReason}`,
        status: 'error', // Explicitly set status to 'error'
      };
    }
    params = result.data;
  }

  // Dynamically select model based on hint or general context
  const selectedModel = await chooseModelBasedOnPrompt(params?.industryHint || "general project idea");
  console.log(`[ProjectIdea] Generating idea using model: ${selectedModel}`);

  try {
    // Call the prompt with the dynamically selected model
    const { output: aiResult } = await generateIdeaPrompt(
        { industryHint: params?.industryHint },
        { model: selectedModel } // Pass selected model here
    );

    // The AI is now expected to return JSON directly. Schema validation is handled by definePrompt.
    // No need for extractJsonFromText or manual parsing if the prompt works correctly.
    if (!aiResult) {
        throw new Error(`AI (${selectedModel}) returned no output.`);
    }

    // aiResult should already match GenerateProjectIdeaAIOutputSchema due to definePrompt's output schema
    // Additional runtime checks can be added if needed, but Zod validation within Genkit is preferred.
    if (aiResult.estimatedHours <= 0) {
        console.warn(`AI (${selectedModel}) returned non-positive estimated hours (${aiResult.estimatedHours}). Adjusting.`);
        aiResult.estimatedHours = 1; // Example: Default to 1 hour
    }

    const baseCost  = aiResult.estimatedHours * DEFAULT_HOURLY_RATE;
    const fee       = baseCost * PLATFORM_FEE_PERCENTAGE;
    const totalCost = baseCost + fee;
    const monthly   = totalCost / SUBSCRIPTION_MONTHS;

    const finalOutput: GenerateProjectIdeaOutput = {
      idea:                    aiResult.idea,
      details:                 aiResult.details,
      estimatedTimeline:       aiResult.estimatedTimeline,
      estimatedHours:          aiResult.estimatedHours,
      requiredSkills:          aiResult.requiredSkills,
      estimatedBaseCost:       Math.round(baseCost * 100) / 100,
      platformFee:             Math.round(fee * 100) / 100,
      totalCostToClient:       Math.round(totalCost * 100) / 100,
      monthlySubscriptionCost: Math.round(monthly * 100) / 100,
      reasoning:               `Based on ${aiResult.estimatedHours}h @ $${DEFAULT_HOURLY_RATE}/h + ${PLATFORM_FEE_PERCENTAGE * 100}% fee, using ${selectedModel}.`,
      status:                  'success',
    };

    // Final validation of the complete output object
    GenerateProjectIdeaOutputSchema.parse(finalOutput);
    return finalOutput;

  } catch (err: any) {
    console.error(`[ProjectIdea] Generation/validation error using ${selectedModel}:`, err.errors ?? err.message ?? err);
    // Ensure the returned error object adheres to the schema
    const errorReason = err.message || err;
    const errorDetails = err.errors ? JSON.stringify(err.errors) : ''; // Include Zod errors if available
    return {
      idea: 'Error',
      details: undefined,
      estimatedTimeline: 'N/A',
      estimatedHours: undefined,
      estimatedBaseCost: undefined,
      platformFee: undefined,
      totalCostToClient: undefined,
      monthlySubscriptionCost: undefined,
      requiredSkills: undefined,
      reasoning: `Failed to generate idea using ${selectedModel}: ${errorReason} ${errorDetails}`,
      status: 'error', // Explicitly set status to 'error'
    };
  }
}
