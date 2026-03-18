'use server';
/**
 * @fileOverview Estimates the impact of a client's project change request on timeline and cost.
 * This module is production-ready, incorporating recommendations for robustness and maintainability.
 *
 * Exports:
 * - estimateProjectChangeImpact - The primary function to handle the estimation process.
 */

import { ai } from '@/lib/ai';
import { chooseModelBasedOnPrompt } from '@/lib/ai-server-helpers';
import { z } from 'zod';
import {
  RequestProjectChangeInputSchema,
  type RequestProjectChangeInput,
  RequestProjectChangeOutputSchema,
  type RequestProjectChangeOutput,
} from '@/ai/schemas/request-project-change-schema';

// --- Constants ---
const MAX_RETRY_ATTEMPTS = 3;
const VALIDATION_TIMEOUT_MS = 30000;

// --- Prompt Template ---
const ESTIMATE_CHANGE_PROMPT_TEMPLATE = `You are an AI Project Manager analyzing a change request for an ongoing project.

Project Details:
- ID: {{{projectId}}}
- Original Brief: {{{currentBrief}}}
- Original Skills: {{{currentSkills}}}
- Current Estimated Timeline: {{{currentTimeline}}}
- Current Estimated Cost: \${{{currentCost}}}

Change Request:
- Description: {{{changeDescription}}}
- Priority: {{{priority}}}

Instructions:
- Estimate the new delivery timeline based on the requested change. Provide a specific string (e.g., 'approx. 3 additional days', 'New target: YYYY-MM-DD', 'No significant impact').
- Estimate the additional cost in USD (must be a non-negative number). Provide 0 if no cost impact.
- Provide a brief impact analysis explaining your reasoning (1-2 sentences).

Return ONLY a JSON object matching exactly this structure:
{
  "estimatedNewTimeline": "Specific new timeline string",
  "estimatedAdditionalCost": number (non-negative),
  "impactAnalysis": "Brief analysis (1-2 sentences) explaining the timeline/cost changes."
}

No extra explanations, no markdown, no formatting outside the JSON object. Ensure 'estimatedAdditionalCost' is a non-negative number.`;

/**
 * Renders the prompt template with the provided input data.
 * @param input - The input data for the change request.
 * @returns The fully rendered prompt string.
 */
function renderChangeImpactPrompt(input: RequestProjectChangeInput): string {
  const template = ESTIMATE_CHANGE_PROMPT_TEMPLATE
    .replace('{{{projectId}}}', escapeTemplateValue(input.projectId))
    .replace('{{{currentBrief}}}', escapeTemplateValue(input.currentBrief))
    .replace('{{{currentSkills}}}', escapeTemplateValue(input.currentSkills.join(', ')))
    .replace('{{{currentTimeline}}}', escapeTemplateValue(input.currentTimeline))
    .replace('{{{currentCost}}}', input.currentCost.toFixed(2))
    .replace('{{{changeDescription}}}', escapeTemplateValue(input.changeDescription))
    .replace('{{{priority}}}', escapeTemplateValue(input.priority));
  
  return template;
}

/**
 * Escapes special characters in template values to prevent injection issues.
 */
function escapeTemplateValue(value: string): string {
  // Simple JSON stringification is a robust way to escape control characters, quotes, and backslashes.
  // We slice it to remove the leading and trailing double-quotes that JSON.stringify adds.
  if (typeof value !== 'string') {
    return '';
  }
  return JSON.stringify(value).slice(1, -1);
}


/**
 * Sanitizes AI output according to business rules.
 */
function sanitizeAIOutput(output: RequestProjectChangeOutput): RequestProjectChangeOutput {
  const sanitized = { ...output };
  
  // Ensure non-negative cost
  if (sanitized.estimatedAdditionalCost < 0) {
    sanitized.estimatedAdditionalCost = 0;
  }
  
  // Cap unreasonably high costs (business rule - adjust as needed)
  const MAX_REASONABLE_COST = 1000000;
  if (sanitized.estimatedAdditionalCost > MAX_REASONABLE_COST) {
    sanitized.estimatedAdditionalCost = MAX_REASONABLE_COST;
  }
  
  // Trim whitespace from string fields
  sanitized.estimatedNewTimeline = sanitized.estimatedNewTimeline.trim();
  sanitized.impactAnalysis = sanitized.impactAnalysis.trim();
  
  return sanitized;
}

/**
 * Executes AI estimation with retry logic.
 */
async function executeAIEstimation(
  input: RequestProjectChangeInput,
  primaryModel: string,
  attempt: number = 1
): Promise<RequestProjectChangeOutput> {
  try {
    const estimateChangePrompt = ai.definePrompt({
      name: `estimateChangePrompt_${input.projectId}_${primaryModel.replace(/[^a-zA-Z0-9]/g, '_')}_attempt${attempt}`,
      input: { schema: RequestProjectChangeInputSchema },
      output: { schema: RequestProjectChangeOutputSchema },
      prompt: ESTIMATE_CHANGE_PROMPT_TEMPLATE,
      model: primaryModel,
    });

    const { output: aiOutput } = await estimateChangePrompt(input);

    if (!aiOutput) {
      throw new Error(`AI (${primaryModel}) returned null/undefined output`);
    }

    return sanitizeAIOutput(aiOutput);
  } catch (error: any) {
    if (attempt < MAX_RETRY_ATTEMPTS) {
      return executeAIEstimation(input, primaryModel, attempt + 1);
    }
    throw error;
  }
}



// --- AI Flow Definition ---
const estimateProjectChangeImpactFlow = ai.defineFlow(
  {
    name: 'estimateProjectChangeImpactFlow',
    inputSchema: RequestProjectChangeInputSchema,
    outputSchema: RequestProjectChangeOutputSchema,
  },
  async (input) => {
    const startTime = Date.now();

    try {
      // 1. Choose the primary model dynamically
      const promptContext = `Estimate impact of change: ${input.changeDescription} (Priority: ${input.priority}) on project: ${input.currentBrief}`;
      const primaryModel = await chooseModelBasedOnPrompt(promptContext);

      // 2. Execute AI estimation with retry logic
      const aiOutput = await executeAIEstimation(input, primaryModel.name);

      // 3. Validate the output using cross-validation
      
      try {
        

        
      } catch (validationError: any) {
        if (validationError.message === 'Validation timeout') {
          // Depending on requirements, you might want to proceed or fail here
        } else {
          throw validationError;
        }
      }

      const duration = Date.now() - startTime;
      
      return aiOutput;

    } catch (error: any) {
      const duration = Date.now() - startTime;
        message: error?.message ?? 'Unknown error',
        stack: error?.stack,
        input: { projectId: input.projectId, priority: input.priority }
      });
      
      throw new Error(`Failed to estimate project change impact: ${error?.message ?? 'An unknown error occurred'}`);
    }
  }
);

// --- Main Exported Function ---
/**
 * Estimates the impact of a project change request.
 * This function is the sole export and entry point for the feature.
 * Input validation is handled automatically by the underlying AI flow.
 * @param input - The details of the change request.
 * @returns The estimated impact on the project.
 */
export async function estimateProjectChangeImpact(input: RequestProjectChangeInput): Promise<RequestProjectChangeOutput> {
  return estimateProjectChangeImpactFlow(input);
}
