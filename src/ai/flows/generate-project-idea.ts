'use server';

/**
 * generate-project-idea.ts
 *
 * Uses your Genkit AI instance to generate a realistic freelance project idea,
 * parses and validates the JSON output, then adds cost estimates.
 */

import { ai } from '@/ai/ai-instance';
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
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
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
  model: 'googleai/gemini-1.5-flash',
  input: { schema: z.object({ industryHint: z.string().optional() }) },
  output: { schema: z.string().describe('Raw JSON with idea, details, etc.') },
  prompt: ({ industryHint }) => `
Generate a single, valid JSON object with keys:
  - idea: string
  - details: string
  - estimatedTimeline: string (e.g. "3-5 days")
  - estimatedHours: number (positive integer)
  - requiredSkills: array of strings

${industryHint ? `Hint: ${industryHint}` : ''}

Do NOT include any markdown or extra text outside the JSON.
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
      console.error('[ProjectIdea] Input validation failed:', result.error.format());
      return {
        ...GenerateProjectIdeaOutputSchema.parse({
          idea: '',
          details: '',
          estimatedTimeline: '',
          estimatedHours: 0,
          requiredSkills: [],
          estimatedBaseCost: 0,
          platformFee: 0,
          totalCostToClient: 0,
          monthlySubscriptionCost: 0,
          reasoning: 'Invalid input provided.',
          status: 'error',
        }),
      };
    }
    params = result.data;
  }

  try {
    const { output: raw } = await generateIdeaPrompt({ industryHint: params?.industryHint });
    const json = extractJsonFromText(raw);
    if (!json) throw new Error('AI response did not contain valid JSON.');

    const aiResult: GenerateProjectIdeaAIOutput = GenerateProjectIdeaAIOutputSchema.parse(json);

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
      reasoning:               `Based on ${aiResult.estimatedHours}h @ $${DEFAULT_HOURLY_RATE}/h + ${PLATFORM_FEE_PERCENTAGE * 100}% fee`,
      status:                  'success',
    };

    GenerateProjectIdeaOutputSchema.parse(finalOutput);
    return finalOutput;

  } catch (err: any) {
    console.error('[ProjectIdea] generation error:', err.message || err);
    return {
      ...GenerateProjectIdeaOutputSchema.parse({
        idea: '',
        details: '',
        estimatedTimeline: '',
        estimatedHours: 0,
        requiredSkills: [],
        estimatedBaseCost: 0,
        platformFee: 0,
        totalCostToClient: 0,
        monthlySubscriptionCost: 0,
        reasoning: `Failed to generate idea: ${err.message || err}`,
        status: 'error',
      }),
    };
  }
}
