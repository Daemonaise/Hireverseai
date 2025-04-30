'use server';

/**
 * generate-project-idea.ts
 *
 * Uses your Genkit AI instance to generate a realistic freelance project idea,
 * parses and validates the JSON output, then adds cost estimates (hourly rate,
 * 15% platform fee, and monthly subscription).
 */

import { ai } from '@/ai/ai-instance'; // Your centralized Genkit instance
import {
  GenerateProjectIdeaInputSchema,
  GenerateProjectIdeaAIOutputSchema,
  GenerateProjectIdeaOutputSchema,
  type GenerateProjectIdeaInput,
  type GenerateProjectIdeaAIOutput,
  type GenerateProjectIdeaOutput,
} from '@/ai/schemas/generate-project-idea-schema';
import { z } from 'zod';

// ─── Constants ─────────────────────────────────────────────────────────────────

const PLATFORM_FEE_PERCENTAGE   = 0.15;
const DEFAULT_HOURLY_RATE       = 65;
const SUBSCRIPTION_MONTHS       = 6; // Divide total by this for monthly cost

// ─── JSON Extraction Helper ────────────────────────────────────────────────────

/**
 * Finds the first JSON object in a text blob and parses it.
 */
function extractJsonFromText(text: string): any | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch (e) {
    console.error('[Idea] JSON parse error:', e, '\nText:', text);
    return null;
  }
}

// ─── Prompt Definition ─────────────────────────────────────────────────────────

const generateIdeaPrompt = ai.definePrompt({
  name:   'generateProjectIdea',
  // You can switch to gemini15Flash / claude35Sonnet / gpt4o here as desired:
  model:  'openai/gpt-4o',
  input:  { schema: z.object({ industryHint: z.string().optional() }) },
  output: {
    schema: z.string().describe('Raw JSON string with keys idea, details, etc.')
  },
  prompt: `
Generate a single, valid JSON object with keys:
  - idea: string
  - details: string
  - estimatedTimeline: string (e.g. "3-5 days")
  - estimatedHours: number (positive integer)
  - requiredSkills: array of strings

${'{ industryHint ? "Hint: " + industryHint : "" }'}

Do NOT include any markdown or text outside the JSON.
`,
});

// ─── Main Exported Function ────────────────────────────────────────────────────

/**
 * Generates, parses, validates and augments a project idea.
 */
export async function generateProjectIdea(
  input?: unknown
): Promise<GenerateProjectIdeaOutput> {
  // 1) Validate incoming shape
  let params: GenerateProjectIdeaInput | undefined;
  if (input) {
    const result = GenerateProjectIdeaInputSchema.safeParse(input);
    if (!result.success) {
      console.error('[Idea] Input validation failed:', result.error.format());
      return { ...GenerateProjectIdeaOutputSchema.parse({}), // defaults
        reasoning: 'Invalid input provided.', status: 'error'
      };
    }
    params = result.data;
  }

  try {
    // 2) Call the AI
    const { output: raw } = await generateIdeaPrompt({
      industryHint: params?.industryHint
    });

    // 3) Extract & parse the JSON
    const json = extractJsonFromText(raw);
    if (!json) {
      throw new Error('AI response did not contain valid JSON.');
    }

    // 4) Validate AI's JSON against your schema
    const aiResult = GenerateProjectIdeaAIOutputSchema.parse(json);

    // 5) Compute costs
    const baseCost   = aiResult.estimatedHours * DEFAULT_HOURLY_RATE;
    const fee        = baseCost * PLATFORM_FEE_PERCENTAGE;
    const totalCost  = baseCost + fee;
    const monthly    = totalCost / SUBSCRIPTION_MONTHS;

    // 6) Assemble final output
    const finalOutput: GenerateProjectIdeaOutput = {
      idea:                   aiResult.idea,
      details:                aiResult.details,
      estimatedTimeline:      aiResult.estimatedTimeline,
      estimatedHours:         aiResult.estimatedHours,
      requiredSkills:         aiResult.requiredSkills,
      estimatedBaseCost:      Math.round(baseCost * 100) / 100,
      platformFee:            Math.round(fee * 100) / 100,
      totalCostToClient:      Math.round(totalCost * 100) / 100,
      monthlySubscriptionCost: Math.round(monthly * 100) / 100,
      reasoning:              `Based on ${aiResult.estimatedHours}h @ $${DEFAULT_HOURLY_RATE}/h + ${PLATFORM_FEE_PERCENTAGE*100}% fee`,
      status:                 'success',
    };

    // 7) Final shape check (will throw if something’s off)
    GenerateProjectIdeaOutputSchema.parse(finalOutput);
    return finalOutput;

  } catch (err: any) {
    console.error('[Idea] generation error:', err);
    return {
      ...GenerateProjectIdeaOutputSchema.parse({}), // defaults
      reasoning: `Failed to generate idea: ${err.message || err}`,
      status:    'error',
    };
  }
}
