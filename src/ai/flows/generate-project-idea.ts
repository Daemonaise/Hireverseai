
'use server';
/**
 * @fileOverview Generates freelance project ideas with cost estimation using AI.
 */

import { ai } from '@/lib/ai';
import { z } from 'zod';
import {
  GenerateProjectIdeaInputSchema,
  GenerateProjectIdeaAIOutputSchema,
  GenerateProjectIdeaOutputSchema,
  type GenerateProjectIdeaInput,
  type GenerateProjectIdeaOutput,
} from '@/ai/schemas/generate-project-idea-schema';
import { MODEL_REGISTRY } from '@/lib/ai-models';

// --- Configuration ---
const PLATFORM_FEE = 0.15;       // 15%
const HOURLY_RATE = 65;          // USD
const SUBSCRIPTION_MONTHS = 6;    // months
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;

// --- Prompt Template ---
const projectIdeaPromptTemplate = `CRITICAL: Your entire response MUST be ONLY a single, valid JSON object.
Do NOT include ANY text or formatting outside the JSON.
Start immediately with '{' and end immediately with '}'.

Your goal is to generate a DIVERSE and UNIQUE freelance project idea. Avoid common or repetitive suggestions.
Consider a wide range of digital freelance work, such as:
- Software Development (web, mobile, API, scripts)
- Creative Writing (blog posts, ad copy, technical writing, fiction snippets)
- Graphic Design (logos, illustrations, social media assets, UI mockups)
- Data Analysis & Visualization
- Digital Marketing (SEO, content strategy, social media campaigns)
- Audio/Video Production (editing, voiceovers, short animations)
- Technical Support or Consultation
- Virtual Assistance or Admin tasks

Generate a project idea based on the hint (if provided).
Use this random factor to inspire creativity and ensure variety: {{{randomNumber}}}

Strictly follow this JSON structure:
{
  "idea": "string (short, catchy project title, non-empty)",
  "details": "string (detailed project description, non-empty, min 10 chars)",
  "estimatedTimeline": "string (e.g., '3-5 days', '1 week', non-empty)",
  "estimatedHours": number (>= 1),
  "requiredSkills": ["array of 1-5 skill strings (non-empty)"]
}
{{#if industryHint}}If an industry hint is provided (Industry: '{{{industryHint}}}'), tailor the project idea to that industry.{{else}}If no industry hint is provided, feel free to pick an interesting category from the list above or generate a completely novel idea.{{/if}}

REMEMBER: ONLY the JSON object.`;

// --- Input Types ---
const PromptInputSchema = GenerateProjectIdeaInputSchema.extend({ randomNumber: z.string() });
type PromptInputType = z.infer<typeof PromptInputSchema>;

// --- Define the reusable prompt object ---
const modelId = MODEL_REGISTRY.google.flash; 

const projectIdeaGenPrompt = ai.definePrompt({
  name: 'generateProjectIdeaPrompt', // Unique name for the prompt
  model: modelId,
  prompt: projectIdeaPromptTemplate, // Handlebars template string
  input: { schema: PromptInputSchema },
  output: { schema: GenerateProjectIdeaAIOutputSchema, structured: true }, // Request structured output
});


// --- Flow Definition ---
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
    let aiResult: z.infer<typeof GenerateProjectIdeaAIOutputSchema> | null = null;
    let lastError: string | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !aiResult; attempt++) {
      const randomNumber = Math.random().toFixed(4); // Generate new random number for each attempt
      try {
        const promptInput: PromptInputType = { ...input, randomNumber };
        
        // Call the defined prompt object
        const { output: parsed } = await projectIdeaGenPrompt(promptInput);
        aiResult = parsed;

      } catch (err: any) {
        lastError = `Error during AI call or processing (attempt ${attempt}): ${err.message || String(err)}`;
        console.error(`[generateProjectIdeaFlow Attempt ${attempt}]`, lastError, err);
        if (attempt < MAX_ATTEMPTS) await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      }
    }

    if (!aiResult) {
      return {
        status: 'error',
        reasoning: `Failed to generate idea after ${MAX_ATTEMPTS} attempts. Last error: ${lastError}`,
        idea: 'Error',
        details: '',
        estimatedTimeline: 'N/A',
        estimatedHours: 0,
        requiredSkills: [],
      };
    }

    // Cost calculations
    const { idea, details, estimatedTimeline, estimatedHours, requiredSkills } = aiResult;
    const baseCost = estimatedHours * HOURLY_RATE;
    const platformFee = baseCost * PLATFORM_FEE;
    const totalCost = baseCost + platformFee;
    const monthlyCost = totalCost / SUBSCRIPTION_MONTHS;

    const result: GenerateProjectIdeaOutput = {
      status: 'success',
      idea,
      details,
      estimatedTimeline,
      estimatedHours,
      requiredSkills,
      estimatedBaseCost: +baseCost.toFixed(2),
      platformFee: +platformFee.toFixed(2),
      totalCostToClient: +totalCost.toFixed(2),
      monthlySubscriptionCost: +monthlyCost.toFixed(2),
      reasoning: `Generated with ${modelId.name} structured output; ${estimatedHours}h @ $${HOURLY_RATE}/h + ${PLATFORM_FEE * 100}% fee.`,
    };

    // Final validation
    GenerateProjectIdeaOutputSchema.parse(result);
    return result;
  }
);

// --- Exported Function ---
export async function generateProjectIdea(
  input?: GenerateProjectIdeaInput
): Promise<GenerateProjectIdeaOutput> {
  const validated = GenerateProjectIdeaInputSchema.parse(input ?? {});
  return generateProjectIdeaFlow(validated);
}
