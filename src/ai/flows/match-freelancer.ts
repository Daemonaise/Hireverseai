
'use server';
/**
 * @fileOverview Match a freelancer to a project with skill extraction, candidate fetching, estimation, and selection.
 * Exports:
 * - matchFreelancer (async function)
 */

import { ai } from '@/lib/ai';
import { chooseModelBasedOnPrompt } from '@/lib/ai-server-helpers';
import { z } from 'zod';
import {
  type MatchFreelancerInput,
  type MatchFreelancerOutput,
  MatchFreelancerInputSchema,
  MatchFreelancerOutputSchema,
  ExtractSkillsAIOutputSchema,
  EstimateAndSelectAIOutputSchema,
} from '@/ai/schemas/match-freelancer-schema';
import {
  fetchFreelancersBySkills,
  type FreelancerProfile,
} from '@/services/freelancer'; // Assuming this service exists and is correctly typed
import { updateProjectStatus } from '@/services/firestore';

// --- Constants ---
const PLATFORM_MARKUP_BASE = 0.15;                     // Base platform markup
const RATING_PREMIUM_INCREMENT = 0.02;                // Premium per rating point above threshold
const COMPLEXITY_SURCHARGE_PERCENT = 0.05;            // Surcharge based on number of skills
const TAX_RATE = 0.07;                                // Example tax rate
const MAX_PROMPT_LENGTH = 15000;
const FEW_SHOT_EXAMPLES: any[] = []; // Corrected initialization to an empty array

// --- Example Coverage Matrix ---
// This matrix outlines covered domains and identifies areas for additional examples.
// | Domain                          | Covered Examples                | Suggested Expansions                               |
// |---------------------------------|---------------------------------|----------------------------------------------------|
// | Graphics & Design               | 3D Design, Product Renders      | Logo Design, Infographic, UI/UX Prototyping       |
// | Digital Marketing               | SEO Website                     | PPC Campaigns, Social Media Ads, Email Automation  |
// | Writing & Translation           | Technical Translation           | Copywriting, Blog Posts, Localization              |
// | Video & Animation               | 3D Rendering                    | Explainer Videos, Motion Graphics, Storyboarding   |
// | Music & Audio                   | Sound Design                    | Podcast Editing, Voiceovers, Music Production     |
// | Programming & Tech              | React Dashboard, Node.js API    | Python Scripting, Java Microservices, Rust Apps   |
// | AI Services                     | ML Model Training               | Chatbot Development, Computer Vision, NLP         |
// | Consulting                      | UX Audit, Financial Modeling    | Strategy Workshops, Market Research               |
// | Data                            | GIS Mapping, Database Migration | ETL Pipelines, Data Visualization, BI Dashboards  |
// | Business                        | Business Plan, Financial Forecast| Pitch Deck Design, Vendor Analysis                |
// | Personal Growth & Hobbies       | UX Audit                        | Life Coaching Prompts, Personal Finance Plans     |
// | Photography                     | Product Photography             | Photo Editing, Drone Photography, Retouching       |
// | Finance                         | Financial Modeling              | Tax Analysis, Investment Portfolio Optimization   |
// | Additional Fields               | See above                       | Video Editing, Content Strategy, VR Simulations    |
// |---------------------------------|---------------------------------|----------------------------------------------------|
//                   // | Content Strategy, Video Editing   | // Ensured this stray line is commented out

// --- Helpers ---
/**
 * Calculate detailed pricing based on freelancer rate, rating, and project complexity.
 */
function calculateCosts(hours: number, hourlyRate: number, rating: number, skillCount: number) {
  const base = hours * hourlyRate;
  // rating premium for high-rated freelancers
  const ratingPremium = rating > 4 ? base * ((rating - 4) * RATING_PREMIUM_INCREMENT) : 0;
  // complexity surcharge if many skills
  const complexityFactor = skillCount > 3 ? (skillCount - 3) * COMPLEXITY_SURCHARGE_PERCENT : 0;
  const complexitySurcharge = base * complexityFactor;
  // platform fee
  const platformFee = base * PLATFORM_MARKUP_BASE;
  // subtotal and tax
  const subtotal = base + ratingPremium + complexitySurcharge + platformFee;
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;
  return {
    estimatedBaseCost: Number(base.toFixed(2)),
    ratingPremium: Number(ratingPremium.toFixed(2)),
    complexitySurcharge: Number(complexitySurcharge.toFixed(2)),
    platformFee: Number(platformFee.toFixed(2)),
    tax: Number(tax.toFixed(2)),
    totalCostToClient: Number(total.toFixed(2)),
  };
}

function truncate(text: string, max: number) {
  return text.length > max ? text.slice(0, max) : text;
}

// --- Prompt Templates with Few-Shot Examples ---
const skillExtractionPromptTemplate = `You are an AI assistant specialized in analyzing project briefs and extracting required skills.
Use the examples below to guide you, then extract the top 1-7 skills for the new brief.

EXAMPLES:
{{#each FEW_SHOT_EXAMPLES}}Project: {{{this.projectBrief}}}
Skills: {{#each this.extractedSkills}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
---
{{/each}}

Now:
Project: {{{projectBrief}}}
Return ONLY JSON:{"extractedSkills": [skills array]}`;

const estimationPromptTemplate = `You are an expert project estimator.
Refer to the examples for guidance.

EXAMPLES:
{{#each FEW_SHOT_EXAMPLES}}Project: {{{this.projectBrief}}}
Skills: {{#each this.extractedSkills}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
Candidates: [{{#each this.candidates}}{{this.id}}(@\${{this.hourlyRate}})[rating:{{this.rating}}]{{#unless @last}}, {{/unless}}{{/each}}]
Output: {"selectedFreelancerId":"{{this.selectedFreelancerId}}","reasoning":"{{this.reasoning}}","estimatedHours":{{this.estimatedHours}},"estimatedTimeline":"{{this.estimatedTimeline}}"}
---
{{/each}}

Now:
Project: {{{projectBrief}}}
Skills: {{#each requiredSkills}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
Candidates: {{#each candidates}}{{this.id}}(@\${{this.hourlyRate}})[rating:{{this.rating}}]{{#unless @last}}, {{/unless}}{{/each}}
Return ONLY JSON with keys selectedFreelancerId, reasoning, estimatedHours, estimatedTimeline.`;

// --- Flow Definition ---
const matchFreelancerFlow = ai.defineFlow(
  {
    name: 'matchFreelancerFlow',
    inputSchema: MatchFreelancerInputSchema,
    outputSchema: MatchFreelancerOutputSchema,
  },
  async (input) => {
    let requiredSkills = input.requiredSkills;
    let reasoning = '';
    const projectId = input.projectId;
    const projectBrief = truncate(input.projectBrief, MAX_PROMPT_LENGTH);

    try {
      // 1. Skill Extraction
      if (!Array.isArray(requiredSkills) || requiredSkills.length === 0) {
        const extractModel = await chooseModelBasedOnPrompt(`Extract skills: ${projectBrief}`);
        const skillPrompt = ai.definePrompt({
          name: `extractSkills_${extractModel.name.replace(/[^a-zA-Z0-9]/g, '_')}`,
          input: { schema: z.object({ projectBrief: z.string().min(1) }) },
          output: { schema: ExtractSkillsAIOutputSchema },
          prompt: skillExtractionPromptTemplate,
          model: extractModel,
          context: { FEW_SHOT_EXAMPLES }
        });
        const { output } = await skillPrompt({ projectBrief });
        if (!output || !output.extractedSkills) {
            throw new Error(`Skill extraction failed or returned invalid output. Model: ${extractModel.name}`);
        }
        
        requiredSkills = output.extractedSkills;
        reasoning += 'Skills extracted by AI. ';
      }
      if (!Array.isArray(requiredSkills) || requiredSkills.length === 0) throw new Error('No skills found');

      // 2. Fetch candidate freelancers
      const candidates: FreelancerProfile[] = await fetchFreelancersBySkills(requiredSkills);
      if (candidates.length === 0) {
        if(projectId) await updateProjectStatus(projectId, 'no_candidates');
        return { projectId, reasoning: 'No matching freelancers.', status: 'no_available_freelancer' };
      }

      // Filter candidates to ensure they have the required properties for estimation.
      const viableCandidates = candidates.filter(
        (c): c is FreelancerProfile & { hourlyRate: number; rating: number } =>
          c.hourlyRate !== undefined && c.rating !== undefined
      );

      if (viableCandidates.length === 0) {
        if (projectId) await updateProjectStatus(projectId, 'no_candidates');
        return {
          projectId,
          reasoning: 'No freelancers with complete profiles (rate and rating) were found.',
          status: 'no_available_freelancer',
        };
      }

      // 3. Estimation & Selection
      const estimateModel = await chooseModelBasedOnPrompt(`Estimate: ${projectBrief}`);
      const estimationPrompt = ai.definePrompt({
        name: `estimate_${estimateModel.name.replace(/[^a-zA-Z0-9]/g, '_')}`,
        input: {
          schema: z.object({
            projectBrief: z.string(),
            requiredSkills: z.array(z.string()),
            candidates: z.array(z.object({ id: z.string(), skills: z.array(z.string()), hourlyRate: z.number(), rating: z.number().min(0).max(5) }))
          })
        },
        output: { schema: EstimateAndSelectAIOutputSchema },
        prompt: estimationPromptTemplate,
        model: estimateModel,
        context: { FEW_SHOT_EXAMPLES }
      });
      const { output: estOut } = await estimationPrompt({ projectBrief, requiredSkills, candidates: viableCandidates });
      if (!estOut) {
        throw new Error(`Estimation and selection failed or returned invalid output. Model: ${estimateModel.name}`);
      }
      
      const estimatedHours = Math.max(estOut.estimatedHours, 0.1);

      // 4. Build and return result
      const selectedProfile = viableCandidates.find(c => c.id === estOut.selectedFreelancerId);
      if (!selectedProfile && estOut.selectedFreelancerId) {
          console.warn(`Selected freelancer ID ${estOut.selectedFreelancerId} not found in candidates list.`);
           if(projectId) await updateProjectStatus(projectId, 'pending');
           return { projectId, reasoning: `Internal error: Selected freelancer profile not found. Reasoning: ${estOut.reasoning}`, status: 'error' };
      }

      const costs = selectedProfile ? calculateCosts(
        estimatedHours,
        selectedProfile.hourlyRate,
        selectedProfile.rating,
        requiredSkills.length
      ) : {}; // Calculate costs only if a freelancer is selected


      const status = estOut.selectedFreelancerId && selectedProfile ? 'matched' : 'no_available_freelancer';
      const result: MatchFreelancerOutput = {
        projectId,
        matchedFreelancerId: estOut.selectedFreelancerId ?? undefined,
        reasoning: reasoning + estOut.reasoning,
        estimatedTimeline: estOut.estimatedTimeline,
        estimatedHours,
        extractedSkills: requiredSkills,
        // pricing breakdown
        ...costs,
        status,
      };
      MatchFreelancerOutputSchema.parse(result); // Validate before returning
      if(projectId) await updateProjectStatus(projectId, 'pending');
      return result;
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : String(error);
      if(projectId) await updateProjectStatus(projectId, 'pending');
      return { projectId, reasoning: `Error: ${msg}`, status: 'error' };
    }
  }
);

export async function matchFreelancer(input: MatchFreelancerInput): Promise<MatchFreelancerOutput> {
  MatchFreelancerInputSchema.parse(input);
  return matchFreelancerFlow(input);
}
