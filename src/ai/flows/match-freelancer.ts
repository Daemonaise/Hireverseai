
'use server';
/**
 * @fileOverview Matches a project brief with the best-fit, available freelancers,
 * and provides cost/timeline estimates.
 * Considers availability, skills, and estimates project scope.
 * Uses the default Google AI model.
 *
 * Exports:
 * - matchFreelancer - A function that handles the freelancer matching and estimation process.
 */

import { ai, getUserSpecificModel } from '@/ai/ai-instance'; // Import 'ai' instance and getUserSpecificModel placeholder
import { z } from 'genkit';
import { getAvailableFreelancersBySkill, assignProjectToFreelancer } from '@/services/firestore'; // Import Firestore service
import type { Freelancer } from '@/types/freelancer'; // Import Freelancer type
import {
    MatchFreelancerInputSchema,
    type MatchFreelancerInput, // Keep type import for internal use
    MatchFreelancerOutputSchema,
} from '@/ai/schemas/match-freelancer-schema'; // Import schemas/types

// --- Constants ---
const PLATFORM_MARKUP_PERCENTAGE = 0.15; // 15%
const DEFAULT_HOURLY_RATE_USD = 50;
const TECH_HOURLY_RATE_USD = 70;
const DESIGN_HOURLY_RATE_USD = 60;
const WRITING_HOURLY_RATE_USD = 55;

// --- Helper Functions ---

/**
 * Calculates the estimated base cost based on hours and skills, reflecting fair US market rates.
 * @param hours Estimated hours for the project.
 * @param skills List of required skills.
 * @returns The estimated base cost in USD.
 */
function calculateEstimatedBaseCost(hours: number, skills: string[]): number {
    // More robust rate calculation based on skill keywords
    let averageRate = DEFAULT_HOURLY_RATE_USD; // Default USD per hour
    const lowerCaseSkills = skills.map(s => s.toLowerCase());

    if (lowerCaseSkills.some(s => s.includes('develop') || s.includes('software') || s.includes('engineer') || s.includes('code') || s.includes('python') || s.includes('react') || s.includes('node') || s.includes('tech'))) {
        averageRate = TECH_HOURLY_RATE_USD;
    } else if (lowerCaseSkills.some(s => s.includes('design') || s.includes('graphic') || s.includes('ui/ux') || s.includes('illustrat'))) {
        averageRate = DESIGN_HOURLY_RATE_USD;
    } else if (lowerCaseSkills.some(s => s.includes('writing') || s.includes('edit') || s.includes('copywrit') || s.includes('content'))) {
        averageRate = WRITING_HOURLY_RATE_USD;
    }
    // Add more sophisticated rate logic based on skill mix if needed

    const estimatedBaseCost = hours * averageRate;
    // Round to 2 decimal places, ensuring it returns a number
    return Number(estimatedBaseCost.toFixed(2));
}


// --- AI Prompts (Defined Statically) ---

const extractSkillsPrompt = ai.definePrompt({
    name: 'extractSkillsFromBrief',
    input: { schema: z.object({ projectBrief: z.string() }) },
    output: { schema: z.object({ extractedSkills: z.array(z.string()).describe("List of up to 5 key skills.") }) },
    // Model defaults to the one configured in ai-instance.ts (gemini-2.0-flash)
    prompt: `Analyze the following project brief and extract the key skills required.
Focus on technical skills, software proficiency, and specific expertise mentioned.
Return ONLY a list of extracted skill names. Limit to a maximum of 5 key skills.

Project Brief:
{{{projectBrief}}}
`,
    config: { temperature: 0.2 } // More deterministic for extraction
});

const estimateAndSelectPrompt = ai.definePrompt({
  name: 'estimateAndSelectPrompt',
  input: {
    schema: z.object({
      projectBrief: z.string(),
      requiredSkills: z.array(z.string()),
      availableFreelancers: z.array(
        z.object({
          id: z.string(),
          skills: z.array(z.string()),
          xp: z.number().optional().default(0), // Provide default
          testScores: z.record(z.number()).optional().default({}), // Provide default
        })
      ).describe("Optional list of available, logged-in freelancers matching at least one skill."),
    }),
  },
  output: {
    schema: z.object({
      selectedFreelancerId: z.string().optional().describe('The ID of the chosen freelancer, or empty if none are suitable/available.'),
      reasoning: z.string().describe('Justification for selecting this freelancer, or why none were chosen. Include estimation rationale.'),
      // Ensure positive estimate slightly > 0
      estimatedHours: z.number().min(0.1, { message: "Estimated hours must be greater than 0." }).describe('Estimated total hours required for the project (realistic US market standard, must be greater than 0).'),
      estimatedTimeline: z.string().describe('Estimated project delivery timeline (e.g., "2-3 days", "1 week").'),
    }),
  },
    // Model defaults to the one configured in ai-instance.ts (gemini-2.0-flash)
  prompt: `You are an AI Project Manager responsible for estimating project scope and assigning tasks to freelancers. Your estimations should reflect fair US market wages.

First, analyze the project brief and required skills to estimate the effort involved.
- Estimate the total number of hours required to complete the project. Be realistic, considering fair US market standards. The estimate MUST be greater than 0.
- Estimate a likely delivery timeline (e.g., "1-2 business days", "about 1 week", "approx. 2 weeks").

Project Brief: {{{projectBrief}}}
Required Skills: {{#each requiredSkills}} - {{this}} {{/each}}

{{#if availableFreelancers}}
Next, review the list of available freelancers who possess at least one required skill, are logged in, and marked as 'available'.

Available Freelancers (Sorted by general availability/rank):
{{#each availableFreelancers}}
---
Freelancer ID: {{{this.id}}}
Skills: {{#each this.skills}} - {{this}} {{/each}}
XP: {{this.xp}}
{{#if this.testScores}}
Test Scores:
{{#each this.testScores}}
  - {{ @key }}: {{this}}/100
{{/each}}
{{/if}}
---
{{/each}}

Select the *single best* freelancer for this project from the available list.
Prioritize freelancers who:
1. Possess *all* or the *most critical* required skills.
2. Have higher relevant skill test scores (if available).
3. Have higher XP (as a secondary factor).

If multiple freelancers are equally suitable, the first one listed is acceptable.
If no freelancer in the list meets the essential skill requirements adequately, do not select anyone.

Provide the ID of the selected freelancer (or empty if none selected) and a brief reasoning for your choice, incorporating your estimations.
{{else}}
No freelancers provided. Focus solely on estimating the project scope based on the brief and skills. Provide reasoning based on the estimation. Do not select a freelancer ID.
{{/if}}

Return the estimated hours (must be > 0), estimated timeline, the selected freelancer ID (if applicable), and your reasoning.
Output format MUST follow the provided schema. Ensure 'estimatedHours' is a positive number greater than 0.
`,
});


// --- Exported Flow Function ---

export async function matchFreelancer(input: MatchFreelancerInput): Promise<z.infer<typeof MatchFreelancerOutputSchema>> {
  return matchFreelancerFlow(input);
}

// --- Main Flow Definition (Internal) ---

const matchFreelancerFlow = ai.defineFlow<
  typeof MatchFreelancerInputSchema,
  typeof MatchFreelancerOutputSchema
>(
  {
    name: 'matchFreelancerFlow',
    inputSchema: MatchFreelancerInputSchema,
    outputSchema: MatchFreelancerOutputSchema,
  },
  async (input) => {
    let requiredSkills = input.requiredSkills ?? []; // Default to empty array if undefined
    let extractedSkills: string[] | undefined = undefined;
    let estimationResult: Awaited<ReturnType<typeof estimateAndSelectPrompt>>['output'] | null = null;
    let estimatedBaseCost = 0;
    let platformFee = 0;
    let totalCostToClient = 0;
    // Remove modelToUse variable as we rely on default model now
    // let modelToUse: string | undefined = undefined;

    // Define a valid fallback output in case of errors before estimationResult is set
    const fallbackOutput: z.infer<typeof MatchFreelancerOutputSchema> = {
       reasoning: "An error occurred early in the matching process.",
       status: 'error',
       estimatedTimeline: "N/A",
       estimatedHours: undefined, // Set to undefined to comply with schema
       estimatedBaseCost: undefined,
       platformFee: undefined,
       totalCostToClient: undefined,
       extractedSkills: undefined,
     };

    try {
      console.log(`Starting freelancer match flow for project brief: "${input.projectBrief.substring(0, 50)}..."`);

      // 0. Remove check for user-specific model (placeholder function still exists but is not used here)
      // const promptOptions = {}; // No specific options needed now

      // 1. Extract Skills if necessary
      if (requiredSkills.length === 0) {
          console.log(`No skills provided, extracting from brief...`);
          // Use default model for extraction
          const { output: skillExtractionResult } = await extractSkillsPrompt({ projectBrief: input.projectBrief });
          if (!skillExtractionResult?.extractedSkills || skillExtractionResult.extractedSkills.length === 0) {
              throw new Error("AI could not extract required skills from the project brief.");
          }
          requiredSkills = skillExtractionResult.extractedSkills;
          extractedSkills = requiredSkills; // Keep track of extracted skills for the output
          console.log(`Extracted skills: ${requiredSkills.join(', ')}`);
      }

      // 2. Get Available Freelancers based on Skills and Availability Status
      console.log(`Searching for available freelancers with skills: ${requiredSkills.join(', ')}`);
      const availableFreelancers = await getAvailableFreelancersBySkill(requiredSkills, 5); // Get top 5 candidates
      console.log(`Found ${availableFreelancers.length} potentially suitable freelancers.`);

      // 3. Use AI to Estimate Scope and Select the Best Match (or just estimate if no candidates)
      console.log(`Estimating project scope and selecting freelancer (if available) using default model...`);
      const estimationInput = {
            projectBrief: input.projectBrief,
            requiredSkills: requiredSkills,
            availableFreelancers: availableFreelancers.map(f => ({
                id: f.id!, // Assume ID is always present after fetch
                skills: f.skills,
                xp: f.xp ?? 0, // Ensure default
                testScores: f.testScores ?? {}, // Ensure default
            })),
      };
       // Use default model for estimation and selection
      estimationResult = (await estimateAndSelectPrompt(estimationInput)).output;

      // Validate required fields and estimatedHours > 0
      if (!estimationResult?.estimatedTimeline || !estimationResult?.estimatedHours || estimationResult.estimatedHours <= 0) {
          console.error("AI failed to provide valid project estimations. Input:", estimationInput, "Output:", estimationResult);
           const reason = !estimationResult?.estimatedHours || estimationResult.estimatedHours <= 0
              ? "AI did not provide a valid positive hour estimate."
              : "AI failed to provide necessary project estimations (hours/timeline).";
          throw new Error(reason);
      }

      // 4. Calculate Costs based on AI estimate
      estimatedBaseCost = calculateEstimatedBaseCost(estimationResult.estimatedHours, requiredSkills);
      platformFee = Number((estimatedBaseCost * PLATFORM_MARKUP_PERCENTAGE).toFixed(2));
      totalCostToClient = Number((estimatedBaseCost + platformFee).toFixed(2));

      console.log(`AI estimated ${estimationResult.estimatedHours} hours, timeline: ${estimationResult.estimatedTimeline}`);
      console.log(`Calculated Costs - Base: $${estimatedBaseCost}, Fee: $${platformFee}, Total: $${totalCostToClient}`);

      // 5. Handle No Match Scenario
      if (availableFreelancers.length === 0 || !estimationResult.selectedFreelancerId) {
          const reasoning = availableFreelancers.length === 0
              ? 'No freelancers are currently available with the required skills. Project scope estimated.'
              : estimationResult.reasoning || 'AI determined no available candidate was a suitable match. Project scope estimated.';
          console.log(`No suitable freelancer matched. Reasoning: ${reasoning}`);
          return {
              reasoning: reasoning,
              estimatedBaseCost: estimatedBaseCost,
              platformFee: platformFee,
              totalCostToClient: totalCostToClient,
              estimatedTimeline: estimationResult.estimatedTimeline,
              estimatedHours: estimationResult.estimatedHours, // Include hours in output
              extractedSkills: extractedSkills,
              status: 'no_available_freelancer',
          };
      }

      // 6. Handle Successful Match
      const selectedFreelancerId = estimationResult.selectedFreelancerId;
      console.log(`AI selected freelancer: ${selectedFreelancerId}. Reasoning: ${estimationResult.reasoning}`);

      // 7. Handle Project Assignment/Update (logic remains the same)
      if (input.projectId) {
         console.log(`Project ${input.projectId} already exists, potential rematch logic needed.`);
      } else {
         console.log(`Freelancer ${selectedFreelancerId} matched. Project assignment needs to occur separately.`);
      }


      // 8. Return Success Output
      return {
        matchedFreelancerId: selectedFreelancerId,
        reasoning: estimationResult.reasoning,
        estimatedBaseCost: estimatedBaseCost,
        platformFee: platformFee,
        totalCostToClient: totalCostToClient,
        estimatedTimeline: estimationResult.estimatedTimeline,
        estimatedHours: estimationResult.estimatedHours, // Include hours in output
        extractedSkills: extractedSkills,
        status: 'matched',
      };

    } catch (error: any) {
      console.error(`Error during freelancer matching/estimation flow:`, error);
      // Ensure the error message includes potential API key issues
      const errorMessage = error.message?.includes('API key')
          ? `An error occurred: Invalid or missing GOOGLE_API_KEY. ${error.message}`
          : `An error occurred: ${error.message || 'Unknown error'}`;

       // Return a structured error response matching the schema
       // Use fallbackOutput as a base and update reasoning
       return {
            ...fallbackOutput, // Ensure all fields are present
            reasoning: errorMessage,
            extractedSkills: extractedSkills, // Keep extracted skills if available
            // Include estimations if they were calculated before the error
            estimatedTimeline: estimationResult?.estimatedTimeline,
            estimatedHours: estimationResult?.estimatedHours && estimationResult.estimatedHours > 0 ? estimationResult.estimatedHours : undefined,
            estimatedBaseCost: estimatedBaseCost > 0 ? estimatedBaseCost : undefined,
            platformFee: platformFee > 0 ? platformFee : undefined,
            totalCostToClient: totalCostToClient > 0 ? totalCostToClient : undefined,
       };
    }
  }
);
