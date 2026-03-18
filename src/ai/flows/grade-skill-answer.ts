'use server';

import { ai } from '@/lib/ai';
import {
  SkillAnswerInputSchema,
  SkillAnswerOutputSchema,
} from '@/ai/schemas/skill-answer-schema';

export const gradeSkillAnswer = ai.defineFlow(
  {
    name: 'gradeSkillAnswer',
    inputSchema: SkillAnswerInputSchema,
    outputSchema: SkillAnswerOutputSchema,
  },
  async (input) => {
    const { text } = await ai.generate({
      model: 'vertexai/gemini-2.0-flash',
      prompt: `You are a strict but fair skill assessment grader for a professional freelancer marketplace.

Grade the following answer on a 0-100 scale.

**Question (${input.difficulty} difficulty, testing ${input.skillTested}):**
${input.questionText}

**Freelancer's Answer:**
${input.answerText}

**Time taken:** ${input.timeSpentSeconds} seconds

**Grading criteria:**
- Accuracy and correctness (40%)
- Completeness and depth (25%)
- Clarity and communication (15%)
- Level-appropriateness — is this answer good for ${input.difficulty} level? (10%)
- Practical applicability (10%)

**Flag detection — check for these issues:**
- ai_generated_suspected: Answer reads like AI-generated content (too perfect, generic phrasing, overly structured)
- plagiarized_suspected: Answer seems copied (unusual vocabulary shifts, formatting inconsistencies)
- irrelevant: Answer doesn't address the question
- too_short: Answer is insufficient for the question's complexity
- timing_anomaly: ${input.timeSpentSeconds < 5 ? 'SUSPICIOUS: answered in under 5 seconds' : input.timeSpentSeconds > 600 ? 'NOTE: took over 10 minutes' : 'normal timing'}

**Difficulty adjustment:**
- Score < 40: suggest "easier"
- Score 40-84: suggest "same"
- Score >= 85: suggest "harder"

Return JSON with: questionId, score (0-100), feedback (specific, 2-3 sentences), flags (array, empty if none), suggestedNextDifficulty`,
    });

    try {
      const parsed = JSON.parse(text.trim().replace(/```json\n?/g, '').replace(/```/g, ''));
      return {
        questionId: input.questionId,
        score: Math.max(0, Math.min(100, Math.round(parsed.score ?? 0))),
        feedback: parsed.feedback || 'No feedback available.',
        flags: parsed.flags || [],
        suggestedNextDifficulty: parsed.suggestedNextDifficulty || 'same',
      };
    } catch {
      return {
        questionId: input.questionId,
        score: 0,
        feedback: 'Grading failed. Please try again.',
        flags: [],
        suggestedNextDifficulty: 'same' as const,
      };
    }
  }
);
