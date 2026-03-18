'use server';

import { ai } from '@/lib/ai';
import {
  PracticalAnswerInputSchema,
  PracticalAnswerOutputSchema,
} from '@/ai/schemas/practical-answer-schema';

export const gradePracticalAnswer = ai.defineFlow(
  {
    name: 'gradePracticalAnswer',
    inputSchema: PracticalAnswerInputSchema,
    outputSchema: PracticalAnswerOutputSchema,
  },
  async (input) => {
    const { text } = await ai.generate({
      model: 'vertexai/gemini-2.0-flash',
      prompt: `You are grading a practical skill challenge for a professional freelancer marketplace.

**Challenge (${input.primarySkill}):**
${input.challengeText}

**Freelancer's Response:**
${input.answerText}

**Time spent:** ${input.timeSpentSeconds} seconds (${Math.round(input.timeSpentSeconds / 60)} minutes)

**Grade on 0-100 scale considering:**
- Quality and correctness (35%)
- Creativity and problem-solving approach (25%)
- Completeness — did they address all parts? (20%)
- Communication clarity (10%)
- Practical applicability — would this work in a real project? (10%)

Return JSON with: challengeId, score (0-100), feedback (2-4 sentences), strengths (array of strings), improvements (array of strings)`,
    });

    try {
      const parsed = JSON.parse(text.trim().replace(/```json\n?/g, '').replace(/```/g, ''));
      return {
        challengeId: input.challengeId,
        score: Math.max(0, Math.min(100, Math.round(parsed.score ?? 0))),
        feedback: parsed.feedback || 'No feedback available.',
        strengths: parsed.strengths || [],
        improvements: parsed.improvements || [],
      };
    } catch {
      return {
        challengeId: input.challengeId,
        score: 0,
        feedback: 'Grading failed.',
        strengths: [],
        improvements: [],
      };
    }
  }
);
