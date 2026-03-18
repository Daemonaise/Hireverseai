'use server';

import { ai } from '@/lib/ai';
import {
  PracticalChallengeInputSchema,
  PracticalChallengeOutputSchema,
} from '@/ai/schemas/practical-challenge-schema';

export const generatePracticalChallenge = ai.defineFlow(
  {
    name: 'generatePracticalChallenge',
    inputSchema: PracticalChallengeInputSchema,
    outputSchema: PracticalChallengeOutputSchema,
  },
  async (input) => {
    const scoreContext = Object.entries(input.skillScoresSoFar)
      .map(([skill, score]) => `${skill}: ${score}/100`)
      .join(', ');

    const { text } = await ai.generate({
      model: 'vertexai/gemini-2.0-flash',
      prompt: `You are designing a practical skill challenge for a freelancer marketplace assessment.

**Freelancer profile:**
- Primary skill: ${input.primarySkill}
- All skills: ${input.allSkills.join(', ')}
- Skill scores so far: ${scoreContext}

**Requirements:**
- Create ONE practical challenge that tests applied ability in ${input.primarySkill}
- Include a realistic client scenario with specific constraints
- The deliverable should be a written response (code, strategy, design rationale, content sample, etc.)
- Should take 5-10 minutes to complete thoughtfully
- Calibrate difficulty based on their scores: ${scoreContext}
- Be specific about what you want delivered — not vague

Return JSON with: challengeId, challengeText, expectedDeliverableType, estimatedMinutes`,
    });

    try {
      const parsed = JSON.parse(text.trim().replace(/```json\n?/g, '').replace(/```/g, ''));
      return {
        challengeId: parsed.challengeId || `pc_${Date.now()}`,
        challengeText: parsed.challengeText || text.trim(),
        expectedDeliverableType: parsed.expectedDeliverableType || 'text',
        estimatedMinutes: parsed.estimatedMinutes || 7,
      };
    } catch {
      return {
        challengeId: `pc_${Date.now()}`,
        challengeText: text.trim(),
        expectedDeliverableType: 'text',
        estimatedMinutes: 7,
      };
    }
  }
);
