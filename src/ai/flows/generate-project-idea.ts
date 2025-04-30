
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
  // type GenerateProjectIdeaAIOutput, // AI Output type not needed directly here
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
  // Improved regex to handle potential surrounding text/markdown
  const match = text.match(/\{[\s\S]*?\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch (e) {
    console.error('[Idea] JSON parse error:', e, '\nText:', text);
    return null;
  }
}

// ─── Prompt Definition ─────────────────────────────────────────────────────────

// Updated prompt to be extremely strict about output format and use correct Handlebars
const generateIdeaPrompt = ai.definePrompt({
  name:   'generateProjectIdea',
  // Using Gemini as the primary model for now
  model:  'googleai/gemini-1.5-flash',
  input:  { schema: z.object({ industryHint: z.string().optional() }) },
  // Expecting a raw JSON string output from the model
  output: { schema: z.string().describe('Raw JSON string') },
  prompt: `
Generate a single, valid JSON object describing a realistic freelance project idea.

**STRICT OUTPUT FORMAT:**
You MUST output ONLY a JSON object. Do NOT include any markdown, comments, or text outside the JSON structure.

The JSON object MUST contain ALL of the following keys, even if you have to use default values:
- "idea": (string) A concise project idea title (e.g., "Social Media Marketing Campaign"). Required, non-empty. Default: "Default Project Idea".
- "details": (string) A brief description of the project. Required, non-empty. Default: "Default project details".
- "estimatedTimeline": (string) An estimated timeframe (e.g., "1 week", "10-14 days"). Required, non-empty. Default: "1 week".
- "estimatedHours": (number) A positive integer representing estimated hours. Required, must be > 0. Default: 10.
- "requiredSkills": (array of strings) A list of 1-5 key skills needed. Required, must contain at least one skill. Default: ["General Skill"].

{{#if industryHint}}
INDUSTRY HINT: Focus on the {{{industryHint}}} industry.
{{/if}}

**EXAMPLE OUTPUT:**
{
  "idea": "Develop a Company Blog",
  "details": "Create a company blog with 5 initial posts focused on sustainability.",
  "estimatedTimeline": "2 weeks",
  "estimatedHours": 25,
  "requiredSkills": ["WordPress", "Copywriting", "SEO"]
}

Remember: ONLY output the JSON object.
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
      // Return a valid error object adhering to the schema
      return {
        idea: 'Error',
        details: 'Invalid input provided.',
        estimatedTimeline: 'N/A',
        status: 'error',
        reasoning: 'Invalid input provided to generateProjectIdea function.',
      };
    }
    params = result.data;
  }

  try {
    // 2) Call the AI
    const { output: rawOutput } = await generateIdeaPrompt({
      industryHint: params?.industryHint, // Pass validated hint, or undefined if no input
    });

    if (!rawOutput) {
      throw new Error("AI returned an empty response.");
    }

    // 3) Extract & parse the JSON
    const json = extractJsonFromText(rawOutput);
    if (!json) {
      console.error('[Idea] AI response did not contain valid JSON. Raw:', rawOutput);
      throw new Error('AI response did not contain valid JSON.');
    }

    // 4) Validate AI's JSON against your schema (stricter validation)
    const aiResult = GenerateProjectIdeaAIOutputSchema.parse(json); // This will throw if invalid

    // 5) Compute costs
    const baseCost   = aiResult.estimatedHours * DEFAULT_HOURLY_RATE;
    const fee        = baseCost * PLATFORM_FEE_PERCENTAGE;
    const totalCost  = baseCost + fee;
    const monthly    = totalCost / SUBSCRIPTION_MONTHS;

    // 6) Assemble final output, ensuring all required fields are present
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
      reasoning:              `Based on ${aiResult.estimatedHours}h @ $${DEFAULT_HOURLY_RATE}/h + ${PLATFORM_FEE_PERCENTAGE * 100}% fee`,
      status:                 'success', // Set status to success here
    };

    // 7) Final shape check (will throw if something’s off)
    GenerateProjectIdeaOutputSchema.parse(finalOutput);
    return finalOutput;

  } catch (err: any) {
    console.error('[Idea] generation error:', err);
    // Ensure the error return object adheres to the schema
    let errorMessage = "Failed to generate project idea.";
    if (err instanceof z.ZodError) {
        errorMessage = `AI response format error: ${err.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ')}`;
    } else if (err instanceof Error) {
        errorMessage = err.message;
    }

    return {
      // Provide default values for required fields in the error case
      idea: 'Error',
      details: errorMessage,
      estimatedTimeline: 'N/A',
      status: 'error', // Explicitly set status to 'error'
      reasoning: `Failed to generate idea: ${errorMessage}`,
    };
  }
}

