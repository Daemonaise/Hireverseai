'use server';
/**
 * @fileOverview Matches a project brief with the best-fit, available freelancers,
 * and provides cost/timeline estimates.
 * Considers availability, skills, and estimates project scope.
 * Uses dynamic model selection based on project brief content.
 *
 * Exports:
 * - matchFreelancer - A function that handles the freelancer matching and estimation process.
 */

import { ai, chooseModelBasedOnPrompt, getUserSpecificModel } from '@/ai/ai-instance'; // Import chooseModelBasedOnPrompt
import { z } from 'genkit';
import { getAvailableFreelancersBySkill } from '@/services/firestore';
import type { Freelancer } from '@/types/freelancer';
import {
    MatchFreelancerInputSchema, // Import schema definition
    type MatchFreelancerInput, // Export type only
    MatchFreelancerOutputSchema, // Import schema definition
    type MatchFreelancerOutput, // Export type only
} from '@/ai/schemas/match-freelancer-schema';

// --- Constants ---
// Keep internal, do not export
const PLATFORM_MARKUP_PERCENTAGE = 0.15;
const DEFAULT_HOURLY_RATE_USD = 50;
const TECH_HOURLY_RATE_USD = 70;
const DESIGN_HOURLY_RATE_USD = 60;
const WRITING_HOURLY_RATE_USD = 55;

// --- Helper Functions ---
// Keep internal, do not export
function calculateEstimatedBaseCost(hours: number, skills: string[]): number {
    let averageRate = DEFAULT_HOURLY_RATE_USD;
    const lowerCaseSkills = skills.map(s => s.toLowerCase());
    if (lowerCaseSkills.some(s => s.includes('develop') || s.includes('software') || s.includes('engineer') || s.includes('code') || s.includes('python') || s.includes('react') || s.includes('node') || s.includes('tech'))) {
        averageRate = TECH_HOURLY_RATE_USD;
    } else if (lowerCaseSkills.some(s => s.includes('design') || s.includes('graphic') || s.includes('ui/ux') || s.includes('illustrat'))) {
        averageRate = DESIGN_HOURLY_RATE_USD;
    } else if (lowerCaseSkills.some(s => s.includes('writing') || s.includes('edit') || s.includes('copywrit') || s.includes('content'))) {
        averageRate = WRITING_HOURLY_RATE_USD;
    }
    return Number((hours * averageRate).toFixed(2));
}

// --- AI Prompt Definition Generators ---

// Generator for skill extraction prompt
// Keep internal, do not export
const createExtractSkillsPrompt = (modelName: string) => ai.definePrompt({
    name: `extractSkillsFromBrief_${modelName.replace(/[^a-zA-Z0-9]/g, '_')}`,
    input: { schema: z.object({ projectBrief: z.string() }) },
    output: { schema: z.object({ extractedSkills: z.array(z.string()).min(1, {message: "Must extract at least one skill."}).max(5).describe("List of 1 to 5 key skills.") }) },
    model: modelName, // Use dynamic model
    prompt: `Analyze the following project brief and extract the key skills required.
Focus on technical skills, software proficiency, and specific expertise mentioned.
Return ONLY a list of 1-5 extracted skill names. If no specific skills are mentioned, infer the most likely general skill category (e.g., "Graphic Design", "Web Development", "Copywriting").

Project Brief:
{{{projectBrief}}}
`,
    config: { temperature: 0.2 }
});

// Generator for estimation and selection prompt
// Keep internal, do not export
const createEstimateAndSelectPrompt = (modelName: string) => ai.definePrompt({
  name: `estimateAndSelectPrompt_${modelName.replace(/[^a-zA-Z0-9]/g, '_')}`,
  input: {
    schema: z.object({
      projectBrief: z.string(),
      requiredSkills: z.array(z.string()),
      availableFreelancers: z.array(
        z.object({
          id: z.string(),
          skills: z.array(z.string()),
          xp: z.number().optional().default(0),
          testScores: z.record(z.number()).optional().default({}),
        })
      ).optional().describe("Optional list of available, logged-in freelancers matching at least one skill."),
    }),
  },
  output: {
    schema: z.object({
      selectedFreelancerId: z.string().optional().describe('The ID of the chosen freelancer, or empty if none are suitable/available.'),
      reasoning: z.string().describe('Justification for selecting this freelancer, or why none were chosen. Include estimation rationale.'),
      // Ensure schema here matches DecomposeProjectSchema's minimum requirement
      estimatedHours: z.number().min(0.1, { message: "Estimated hours must be greater than 0." }).describe('Estimated total hours required for the project (realistic US market standard, must be greater than 0).'),
      estimatedTimeline: z.string().describe('Estimated project delivery timeline (e.g., "2-3 days", "1 week").'),
    }),
  },
  model: modelName, // Use dynamic model
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

// Export only the async wrapper function and types
export type { MatchFreelancerInput, MatchFreelancerOutput };

// --- Exported Flow Function (Server Action) ---
export async function matchFreelancer(input: MatchFreelancerInput): Promise<MatchFreelancerOutput> {
  return matchFreelancerFlow(input);
}

// --- Main Flow Definition (Internal) ---
// Keep internal, do not export
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
    let requiredSkills = input.requiredSkills ?? [];
    let extractedSkills: string[] | undefined = undefined;
    let estimationResult: Awaited<ReturnType<typeof estimateAndSelectPrompt>>['output'] | null = null;
    let estimatedBaseCost = 0;
    let platformFee = 0;
    let totalCostToClient = 0;

    // Choose model based on the project brief content - Await the async function
    const selectedModel = await chooseModelBasedOnPrompt(input.projectBrief);
    console.log(`Starting freelancer match flow using model: ${selectedModel}`);

    const fallbackOutput: MatchFreelancerOutput = {
       reasoning: `An error occurred early in the matching process using ${selectedModel}.`,
       status: 'error',
       estimatedTimeline: "N/A",
       estimatedHours: undefined,
       estimatedBaseCost: undefined,
       platformFee: undefined,
       totalCostToClient: undefined,
       extractedSkills: undefined,
     };

    try {
      // 1. Extract Skills if necessary using the chosen model
      if (!requiredSkills || requiredSkills.length === 0) {
          console.log(`No skills provided, extracting from brief using ${selectedModel}...`);
          const extractSkillsPrompt = createExtractSkillsPrompt(selectedModel);
          const { output: skillExtractionResult } = await extractSkillsPrompt({ projectBrief: input.projectBrief });
          if (!skillExtractionResult?.extractedSkills || skillExtractionResult.extractedSkills.length === 0) {
              throw new Error(`AI (${selectedModel}) could not extract required skills from the project brief.`);
          }
          requiredSkills = skillExtractionResult.extractedSkills;
          extractedSkills = requiredSkills;
          console.log(`Extracted skills using ${selectedModel}: ${requiredSkills.join(', ')}`);
      }

      // 2. Get Available Freelancers (Firestore logic remains the same)
      console.log(`Searching for available freelancers with skills: ${requiredSkills.join(', ')}`);
      const availableFreelancers = await getAvailableFreelancersBySkill(requiredSkills, 5);
      console.log(`Found ${availableFreelancers.length} potentially suitable freelancers.`);

      // 3. Estimate Scope and Select Match using the chosen model
      console.log(`Estimating project scope and selecting freelancer (if available) using ${selectedModel}...`);
      const estimateAndSelectPrompt = createEstimateAndSelectPrompt(selectedModel);
      const estimationInput = {
            projectBrief: input.projectBrief,
            requiredSkills: requiredSkills,
            availableFreelancers: availableFreelancers.map(f => ({
                id: f.id!,
                skills: f.skills,
                xp: f.xp ?? 0,
                testScores: f.testScores ?? {},
            })),
      };
      estimationResult = (await estimateAndSelectPrompt(estimationInput)).output;

      if (!estimationResult?.estimatedTimeline || !estimationResult?.estimatedHours || estimationResult.estimatedHours <= 0) {
          console.error(`AI (${selectedModel}) failed to provide valid project estimations. Input:`, estimationInput, "Output:", estimationResult);
           const reason = !estimationResult?.estimatedHours || estimationResult.estimatedHours <= 0
              ? `AI (${selectedModel}) did not provide a valid positive hour estimate.`
              : `AI (${selectedModel}) failed to provide necessary project estimations (hours/timeline).`;
          throw new Error(reason);
      }

      // 4. Calculate Costs (logic remains the same)
      estimatedBaseCost = calculateEstimatedBaseCost(estimationResult.estimatedHours, requiredSkills);
      platformFee = Number((estimatedBaseCost * PLATFORM_MARKUP_PERCENTAGE).toFixed(2));
      totalCostToClient = Number((estimatedBaseCost + platformFee).toFixed(2));

      console.log(`AI (${selectedModel}) estimated ${estimationResult.estimatedHours} hours, timeline: ${estimationResult.estimatedTimeline}`);
      console.log(`Calculated Costs - Base: $${estimatedBaseCost}, Fee: $${platformFee}, Total: $${totalCostToClient}`);

      // 5. Handle No Match Scenario
      if (availableFreelancers.length === 0 || !estimationResult.selectedFreelancerId) {
          const reasoning = availableFreelancers.length === 0
              ? `No freelancers are currently available with the required skills. Project scope estimated by ${selectedModel}.`
              : (estimationResult.reasoning || `AI (${selectedModel}) determined no available candidate was a suitable match. Project scope estimated.`);
          console.log(`No suitable freelancer matched. Reasoning: ${reasoning}`);
          return {
              reasoning: reasoning,
              estimatedBaseCost: estimatedBaseCost,
              platformFee: platformFee,
              totalCostToClient: totalCostToClient,
              estimatedTimeline: estimationResult.estimatedTimeline,
              estimatedHours: estimationResult.estimatedHours,
              extractedSkills: extractedSkills,
              status: 'no_available_freelancer',
          };
      }

      // 6. Handle Successful Match
      const selectedFreelancerId = estimationResult.selectedFreelancerId;
      console.log(`AI (${selectedModel}) selected freelancer: ${selectedFreelancerId}. Reasoning: ${estimationResult.reasoning}`);

      // 7. Handle Project Assignment/Update (assignment occurs separately)
      if (input.projectId) {
         console.log(`Project ${input.projectId} already exists, potential rematch logic needed or update existing project.`);
      } else {
         console.log(`Freelancer ${selectedFreelancerId} matched by ${selectedModel}. Project assignment needs to occur separately after client confirmation.`);
      }


      // 8. Return Success Output
      return {
        matchedFreelancerId: selectedFreelancerId,
        reasoning: estimationResult.reasoning,
        estimatedBaseCost: estimatedBaseCost,
        platformFee: platformFee,
        totalCostToClient: totalCostToClient,
        estimatedTimeline: estimationResult.estimatedTimeline,
        estimatedHours: estimationResult.estimatedHours,
        extractedSkills: extractedSkills,
        status: 'matched',
      };

    } catch (error: any) {
      console.error(`Error during freelancer matching/estimation flow using ${selectedModel}:`, error);
      const errorMessage = error.message?.includes('API key') || error.message?.includes('Authentication failed')
          ? `An error occurred with ${selectedModel}: Invalid or missing API Key. ${error.message}`
           : error.message?.includes('Schema validation failed') || error.message?.includes('positive hour estimate')
           ? `AI response from ${selectedModel} did not match expected format. ${error.message}`
           : `An error occurred during matching with ${selectedModel}: ${error.message || 'Unknown error'}`;

       return {
            ...fallbackOutput,
            reasoning: errorMessage,
            extractedSkills: extractedSkills,
            estimatedTimeline: estimationResult?.estimatedTimeline ?? 'N/A',
            estimatedHours: estimationResult?.estimatedHours && estimationResult.estimatedHours > 0 ? estimationResult.estimatedHours : undefined,
            estimatedBaseCost: estimatedBaseCost > 0 ? estimatedBaseCost : undefined,
            platformFee: platformFee > 0 ? platformFee : undefined,
            totalCostToClient: totalCostToClient > 0 ? totalCostToClient : undefined,
       };
    }
  }
);
