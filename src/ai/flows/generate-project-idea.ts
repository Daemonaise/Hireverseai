'use server';
/**
 * @fileOverview Generates a fresh project idea for clients, with real-world estimated costs.
 */

import { callAI } from '@/ai/ai-instance';
// import { chooseModelBasedOnPrompt } from '@/lib/model-selector'; // Removing dependency as model selection is simplified
import {
  GenerateProjectIdeaInputSchema,
  GenerateProjectIdeaAIOutputSchema,
  GenerateProjectIdeaOutputSchema,
  type GenerateProjectIdeaOutput,
  type GenerateProjectIdeaInput, // Exporting type is okay
} from '@/ai/schemas/generate-project-idea-schema';

// --- Platform fee configuration ---
const PLATFORM_FEE_PERCENTAGE = 0.15; // 15% markup
const DEFAULT_HOURLY_RATE = 65; // Default USD rate if no better data is available
const SUBSCRIPTION_MONTHS = 6; // Default assumption if calculating monthly cost

// Ensure only the async function is exported
export async function generateProjectIdea(input?: unknown): Promise<GenerateProjectIdeaOutput> {
  try {
    // Validate optional input (industry hint)
    const parsedInput = input ? GenerateProjectIdeaInputSchema.parse(input) : undefined;

    // --- 1. Model selection ---
    // Simplified: Directly use Gemini via callAI until other plugins are configured
    const selectedModel = 'gemini'; // Always use Gemini for now

    // --- 2. Build dynamic prompt ---
    const prompt = `Generate a realistic, unique, and feasible project idea that could be completed remotely by a freelancer.
If an industry hint is provided, prefer aligning the project to that industry.
Use realistic estimates based on fair US freelance rates (~$65/hour baseline).
Output ONLY a strict JSON object with fields: idea, details, estimatedTimeline, estimatedHours (positive number, greater than 0), requiredSkills (optional array).

${parsedInput?.industryHint ? `Industry Hint: ${parsedInput.industryHint}` : ''}

Example JSON structure:
{
  "idea": "Build a custom landing page with animations for a startup",
  "details": "Create a modern, mobile-responsive landing page using React and Tailwind CSS with custom SVG animations.",
  "estimatedTimeline": "5-7 days",
  "estimatedHours": 30,
  "requiredSkills": ["React", "Web Design", "CSS Animations"]
}`;

    // --- 3. Call AI ---
    const response = await callAI(selectedModel, prompt);
    const cleanedResponse = response.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    const parsedAIOutput = GenerateProjectIdeaAIOutputSchema.parse(JSON.parse(cleanedResponse));

    // Additional validation for estimatedHours > 0
    if (parsedAIOutput.estimatedHours <= 0) {
      throw new Error("AI returned an invalid estimate for hours (must be > 0).");
    }

    // --- 4. Calculate realistic cost estimates ---
    const estimatedBaseCost = parsedAIOutput.estimatedHours * DEFAULT_HOURLY_RATE;
    const platformFee = estimatedBaseCost * PLATFORM_FEE_PERCENTAGE;
    const totalCostToClient = estimatedBaseCost + platformFee;
    const monthlySubscriptionCost = totalCostToClient / SUBSCRIPTION_MONTHS;

    // --- 5. Return full final structured output ---
    const finalOutput: GenerateProjectIdeaOutput = {
      idea: parsedAIOutput.idea,
      details: parsedAIOutput.details,
      estimatedTimeline: parsedAIOutput.estimatedTimeline,
      estimatedHours: parsedAIOutput.estimatedHours,
      estimatedBaseCost: Math.round(estimatedBaseCost * 100) / 100,
      platformFee: Math.round(platformFee * 100) / 100,
      totalCostToClient: Math.round(totalCostToClient * 100) / 100,
      monthlySubscriptionCost: Math.round(monthlySubscriptionCost * 100) / 100,
      reasoning: `Calculated based on ${parsedAIOutput.estimatedHours} hours at $${DEFAULT_HOURLY_RATE}/hr with a ${PLATFORM_FEE_PERCENTAGE * 100}% platform fee.`,
      status: 'success',
      requiredSkills: parsedAIOutput.requiredSkills,
    };

    // Final validation against the full output schema
    return GenerateProjectIdeaOutputSchema.parse(finalOutput);
  } catch (error: any) {
    console.error('Error generating project idea:', error.message ?? error);
    return {
      idea: '',
      details: '',
      estimatedTimeline: '',
      estimatedHours: undefined,
      estimatedBaseCost: undefined,
      platformFee: undefined,
      totalCostToClient: undefined,
      monthlySubscriptionCost: undefined,
      reasoning: `Failed to generate or validate the project idea output: ${error.message}`, // Include error message
      status: 'error',
      requiredSkills: [],
    };
  }
}

// Exporting types is allowed from 'use server' files
export type { GenerateProjectIdeaOutput, GenerateProjectIdeaInput };
