'use server';

import { ai } from '@/lib/ai';
import {
  AnalyzeProjectInputSchema,
  AnalyzeProjectOutputSchema,
} from '@/ai/schemas/analyze-project-schema';

export const analyzeProject = ai.defineFlow(
  {
    name: 'analyzeProject',
    inputSchema: AnalyzeProjectInputSchema,
    outputSchema: AnalyzeProjectOutputSchema,
  },
  async (input) => {
    const { text } = await ai.generate({
      model: 'googleai/gemini-2.0-flash',
      prompt: `You are an expert project manager for a freelancer marketplace that supports all digital services (programming, design, writing, marketing, video, music, business, translation, AI/data).

Analyze this project and determine what's needed.

**Category selected by client:** ${input.category}
**Client priority:** ${input.clientPriority}

**Project Brief:**
${input.brief}

Analyze and return JSON:
{
  "projectTypes": ["list of service categories this project spans — may include categories beyond what the client selected"],
  "requiredRoles": ["specific roles needed, e.g., 'frontend_developer', 'ui_designer', 'copywriter', 'seo_specialist'"],
  "complexity": "simple | moderate | complex",
  "estimatedTotalHours": number,
  "suggestedMilestoneCount": number (1-10, based on complexity)
}

Guidelines:
- simple: < 10 hours, 1-2 roles, 1-2 milestones
- moderate: 10-40 hours, 2-4 roles, 2-4 milestones
- complex: 40+ hours, 4+ roles, 4-6 milestones
- Roles should be specific (not "designer" but "ui_designer" or "brand_designer")
- Consider cross-category needs (a website project needs programming + design + writing)`,
    });

    try {
      const parsed = JSON.parse(text.trim().replace(/```json\n?/g, '').replace(/```/g, ''));
      return {
        projectTypes: parsed.projectTypes || [input.category],
        requiredRoles: parsed.requiredRoles || [],
        complexity: parsed.complexity || 'moderate',
        estimatedTotalHours: parsed.estimatedTotalHours || 20,
        suggestedMilestoneCount: parsed.suggestedMilestoneCount || 3,
      };
    } catch {
      return {
        projectTypes: [input.category],
        requiredRoles: [],
        complexity: 'moderate' as const,
        estimatedTotalHours: 20,
        suggestedMilestoneCount: 3,
      };
    }
  }
);
