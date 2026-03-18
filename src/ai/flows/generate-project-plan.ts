'use server';

import { ai } from '@/lib/ai';
import {
  GenerateProjectPlanInputSchema,
  GenerateProjectPlanOutputSchema,
} from '@/ai/schemas/generate-project-plan-schema';

export const generateProjectPlan = ai.defineFlow(
  {
    name: 'generateProjectPlan',
    inputSchema: GenerateProjectPlanInputSchema,
    outputSchema: GenerateProjectPlanOutputSchema,
  },
  async (input) => {
    const { text } = await ai.generate({
      model: 'vertexai/gemini-2.0-flash',
      prompt: `You are an expert project manager decomposing a project into milestones and microtasks for a freelancer marketplace.

**Project Brief:**
${input.brief}

**Analysis Results:**
- Categories: ${input.projectTypes.join(', ')}
- Required Roles: ${input.requiredRoles.join(', ')}
- Complexity: ${input.complexity}
- Estimated Total Hours: ${input.estimatedTotalHours}
- Suggested Milestones: ${input.suggestedMilestoneCount}
- Client Priority: ${input.clientPriority}

Generate a structured project plan as JSON:
{
  "milestones": [{
    "id": "m1",
    "name": "Phase name",
    "order": 1,
    "dependencies": [],
    "qaGateEnabled": true,
    "tasks": [{
      "id": "t1.1",
      "description": "Clear, actionable task description (min 10 chars)",
      "role": "specific_role_name",
      "requiredSkill": "Skill Name",
      "minCertificationLevel": "beginner|intermediate|advanced|expert|master",
      "estimatedHours": 3,
      "dependencies": [],
      "parallelGroup": "group-id"
    }]
  }]
}

Rules:
- Tasks within the same parallelGroup can run simultaneously
- Tasks with dependencies must wait for those tasks to complete
- Each milestone ends with a QA gate (qaGateEnabled: true) unless it's trivial
- Set minCertificationLevel based on task complexity:
  * Simple/routine work: beginner or intermediate
  * Standard professional work: intermediate or advanced
  * Complex/architectural: advanced or expert
  * Critical/novel: expert or master
- ${input.clientPriority === 'budget' ? 'Prefer lower certification levels where quality is still acceptable' : ''}
- ${input.clientPriority === 'quality' ? 'Prefer higher certification levels for quality assurance' : ''}
- ${input.clientPriority === 'speed' ? 'Maximize parallel tasks across milestones where possible' : ''}
- Milestones should follow the natural workflow for the project type
- Cross-milestone dependencies are allowed (a dev task can depend on a design task in a previous milestone)`,
    });

    try {
      const parsed = JSON.parse(text.trim().replace(/```json\n?/g, '').replace(/```/g, ''));
      return { milestones: parsed.milestones || [] };
    } catch {
      return { milestones: [] };
    }
  }
);
