'use server';

import { ai } from '@/lib/ai';
import {
  SkillQuestionInputSchema,
  SkillQuestionOutputSchema,
} from '@/ai/schemas/skill-question-schema';

export const generateSkillQuestion = ai.defineFlow(
  {
    name: 'generateSkillQuestion',
    inputSchema: SkillQuestionInputSchema,
    outputSchema: SkillQuestionOutputSchema,
  },
  async (input) => {
    const previousList = input.previousQuestions?.length
      ? `\nPreviously asked (DO NOT repeat):\n${input.previousQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
      : '';

    const { text } = await ai.generate({
      model: 'googleai/gemini-2.0-flash',
      prompt: `You are a professional skill assessment designer for a freelancer marketplace.

Generate ONE scenario-based question to test "${input.targetSkill}" at ${input.difficulty} difficulty level.

The freelancer also knows: ${input.skills.join(', ')}.

Requirements:
- Create a realistic, practical scenario (client brief, code sample, data table, design problem, etc.)
- The question should have a clear right answer or best approach
- ${input.difficulty === 'master' ? 'Include edge cases, ambiguity, or trick elements that test deep expertise' : ''}
- ${input.difficulty === 'beginner' ? 'Keep it straightforward and test fundamentals' : ''}
- ${input.difficulty === 'expert' ? 'Test advanced concepts, best practices, and architectural thinking' : ''}
- Include any necessary context (code snippets, data, specs) directly in the question text
- Question should be answerable in 1-3 minutes of typing
${previousList}

Return a JSON object with:
- questionId: "q_${input.sessionSeed}_${Date.now()}"
- questionText: the full question
- skillTested: "${input.targetSkill}"
- difficulty: "${input.difficulty}"
- questionCategory: a short label for the question type`,
    });

    try {
      const parsed = JSON.parse(text.trim().replace(/```json\n?/g, '').replace(/```/g, ''));
      return {
        questionId: parsed.questionId || `q_${input.sessionSeed}_${Date.now()}`,
        questionText: parsed.questionText || text.trim(),
        skillTested: input.targetSkill,
        difficulty: input.difficulty,
        questionCategory: parsed.questionCategory || 'general',
      };
    } catch {
      return {
        questionId: `q_${input.sessionSeed}_${Date.now()}`,
        questionText: text.trim(),
        skillTested: input.targetSkill,
        difficulty: input.difficulty,
        questionCategory: 'general',
      };
    }
  }
);
