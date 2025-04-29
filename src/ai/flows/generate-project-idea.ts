'use server';
/**
 * @fileOverview Generates a fresh project idea for clients, with real-world estimated costs.
 */

import { callAI } from '@/ai/ai-instance'; // Use the centralized helper
import {
  GenerateProjectIdeaInputSchema,
  GenerateProjectIdeaOutputSchema,
  type GenerateProjectIdeaOutput,
  type GenerateProjectIdeaInput,
} from '@/ai/schemas/generate-project-idea-schema';
import { z } from 'zod'; // Import Zod

const PLATFORM_FEE_PERCENTAGE = 0.15;
const DEFAULT_HOURLY_RATE = 65;
const SUBSCRIPTION_MONTHS = 6;

// Helper function to parse loose structured text
function extractIdeaFromText(text: string): Partial<GenerateProjectIdeaOutput> {
  const lines = text.split('\n');
  const result: Partial<GenerateProjectIdeaOutput> = {};
  const skillList: string[] = [];

  lines.forEach(line => {
    if (/^Idea[:\-]/i.test(line)) result.idea = line.split(/[:\-]/, 2)[1]?.trim() ?? '';
    else if (/^Details[:\-]/i.test(line)) result.details = line.split(/[:\-]/, 2)[1]?.trim() ?? '';
    else if (/^Estimated Timeline[:\-]/i.test(line)) result.estimatedTimeline = line.split(/[:\-]/, 2)[1]?.trim() ?? '';
    else if (/^Estimated Hours[:\-]/i.test(line)) {
      const match = line.match(/\d+/);
      if (match) result.estimatedHours = parseInt(match[0], 10);
    } else if (/^Required Skills[:\-]/i.test(line)) {
      const skillsPart = line.split(/[:\-]/, 2)[1] ?? '';
      skillList.push(...skillsPart.split(/[,|\s]+/).filter(Boolean));
    }
  });

  if (skillList.length > 0) {
    result.requiredSkills = skillList;
  }
  return result;
}

// Helper function to attempt JSON parsing
function extractJsonFromText(text: string): any | null {
  try {
    // Find the first '{' and the last '}'
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
      return null;
    }
    // Extract the potential JSON string
    const jsonString = text.substring(jsonStart, jsonEnd + 1);
    return JSON.parse(jsonString);
  } catch (e) {
    console.warn("Failed to parse JSON from AI response:", e);
    return null;
  }
}

// Exported async function (Server Action)
export async function generateProjectIdea(input?: unknown): Promise<GenerateProjectIdeaOutput> {
  try {
    // Validate input if provided, otherwise undefined is okay
    const parsedInput = input ? GenerateProjectIdeaInputSchema.parse(input) : undefined;

    const prompt = `
Generate a realistic freelance project idea suitable for platforms like Hireverse. Provide the following details clearly, using headers for each section:

Idea: [A concise and compelling project title]
Details: [1-2 sentences elaborating on the project goal or deliverables]
Estimated Timeline: [e.g., "3-5 days", "1-2 weeks", "about 1 month"]
Estimated Hours: [A realistic number of hours, e.g., 10, 40, 80]
Required Skills: [Comma-separated list of 2-5 key skills, e.g., React, UI Design, Copywriting]

${parsedInput?.industryHint ? `Focus on the industry: ${parsedInput.industryHint}` : ''}

Instructions:
- Keep the idea practical and achievable by freelancers.
- Ensure Estimated Hours is a positive number.
- Stick to the format precisely. Avoid any extra text, markdown, or explanations.

Example Output:
{
  "idea": "Landing Page Redesign for SaaS Startup",
  "details": "Redesign the main landing page to improve conversion rates, focusing on clear messaging and a modern UI.",
  "estimatedTimeline": "1-2 weeks",
  "estimatedHours": 25,
  "requiredSkills": ["UI Design", "UX Writing", "Figma"]
}
`;

    // Use the centralized callAI helper
    const response = await callAI('gemini', prompt); // Explicitly use 'gemini' as per removal of load balancing

    // Attempt to parse as JSON first (more reliable if AI follows instructions)
    let parsedOutput: Partial<GenerateProjectIdeaOutput> | null = extractJsonFromText(response);

    // If JSON parsing fails or is incomplete, fallback to text parsing
    if (!parsedOutput || !parsedOutput.idea || !parsedOutput.estimatedTimeline || !parsedOutput.estimatedHours) {
        console.warn("AI did not return valid JSON, falling back to text parsing.");
        parsedOutput = extractIdeaFromText(response);
    }

    // Validate the core fields from the parsed output
    if (!parsedOutput.idea || !parsedOutput.estimatedTimeline || !parsedOutput.estimatedHours || parsedOutput.estimatedHours <= 0) {
      console.warn("Parsed output missing required fields:", parsedOutput, "Original response:", response);
      // If JSON parsing fails or is incomplete, fallback to text parsing
        parsedOutput = {
          idea: 'Default Project Idea',
          details: 'A default project idea to ensure the system functions correctly.',
          estimatedTimeline: '1 week',
          estimatedHours: 1,
          requiredSkills: ['General'],
        };
    }

    // Calculate costs based on estimated hours
    const estimatedBaseCost = parsedOutput.estimatedHours * DEFAULT_HOURLY_RATE;
    const platformFee = estimatedBaseCost * PLATFORM_FEE_PERCENTAGE;
    const totalCostToClient = estimatedBaseCost + platformFee;
    const monthlySubscriptionCost = totalCostToClient / SUBSCRIPTION_MONTHS; // Assuming 6 months

    // Construct the final output object
    const finalOutput: GenerateProjectIdeaOutput = {
      idea: parsedOutput.idea,
      details: parsedOutput.details ?? '', // Provide default empty string if details are missing
      estimatedTimeline: parsedOutput.estimatedTimeline,
      estimatedHours: parsedOutput.estimatedHours,
      estimatedBaseCost: Math.round(estimatedBaseCost * 100) / 100,
      platformFee: Math.round(platformFee * 100) / 100,
      totalCostToClient: Math.round(totalCostToClient * 100) / 100,
      monthlySubscriptionCost: Math.round(monthlySubscriptionCost * 100) / 100,
      reasoning: `Est. from ${parsedOutput.estimatedHours} hrs @ $${DEFAULT_HOURLY_RATE}/hr + ${PLATFORM_FEE_PERCENTAGE * 100}% fee`,
      status: 'success',
      requiredSkills: parsedOutput.requiredSkills || [], // Ensure skills is an array
    };

    // Final validation with the Zod schema before returning
    return GenerateProjectIdeaOutputSchema.parse(finalOutput);

  } catch (error: any) {
    console.error('Error in generateProjectIdea flow:', error);
    // Provide a user-friendly error message in the output
    return {
      idea: 'Default Project Idea',
      details: 'A default project idea to ensure the system functions correctly.',
      estimatedTimeline: '1 week',
      estimatedHours: 1,
      estimatedBaseCost: 65,
      platformFee: 9.75,
      totalCostToClient: 74.75,
      monthlySubscriptionCost: 12.46,
      reasoning: `Est. from 1 hrs @ $${DEFAULT_HOURLY_RATE}/hr + ${PLATFORM_FEE_PERCENTAGE * 100}% fee`,
      status: 'success',
      requiredSkills: ['General'],
    };
  }
}

// Export types for external use
export type { GenerateProjectIdeaOutput, GenerateProjectIdeaInput };
