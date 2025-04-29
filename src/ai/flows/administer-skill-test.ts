'use server';
/**
 * @fileOverview Generates skill test questions for freelancers based on their selected skills.
 *
 * Exports:
 * - administerSkillTest - Generates and returns test questions.
 * - AdministerSkillTestInput - Input type.
 * - AdministerSkillTestOutput - Output type.
 * - Question - Individual question type.
 */
import { callAI } from '@/ai/ai-instance';
import { chooseModelBasedOnPrompt } from '@/lib/model-selector';
import {
  AdministerSkillTestInputSchema,
  type AdministerSkillTestInput,
  AdministerSkillTestOutputSchema,
  type AdministerSkillTestOutput,
  QuestionSchema,
  type Question,
} from '@/ai/schemas/administer-skill-test-schema';

export type { AdministerSkillTestInput, AdministerSkillTestOutput, Question };

// --- Main function ---
export async function administerSkillTest(input: AdministerSkillTestInput): Promise<AdministerSkillTestOutput> {
  const testId = `test_${input.freelancerId}_${Date.now()}`;
  const questions: Question[] = [];

  console.log(`Generating skill test for Freelancer ${input.freelancerId} with skills: ${input.skills.join(', ')}`);

  // Loop through each skill and generate a question
  for (const skill of input.skills) {
    try {
      const selectedModel = chooseModelBasedOnPrompt(skill);
      console.log(`Generating question for skill: ${skill} using model: ${selectedModel}`);

      const promptText = `You are an AI hiring assistant specializing in creating skill assessment questions.
Generate exactly ONE practical and relevant test question for a freelancer (ID: ${input.freelancerId}) claiming the following skill: ${skill}.
The question should effectively probe their proficiency in this specific skill.

Focus on realistic scenarios:
- For visual skills (e.g., Graphic Design), ask to describe design processes or critique examples.
- For technical skills (e.g., React Development), ask conceptual or code analysis questions.
- For writing skills (e.g., Copywriting), ask to write or critique a short text.

Return ONLY a JSON object with:
{
  "questionText": "The test question.",
  "skillTested": "${skill}"
}
Do NOT add any extra explanations outside the JSON object.`;

      const responseString = await callAI(selectedModel, promptText);

      // Clean and validate AI output
      const cleanedResponse = responseString.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      const parsed = JSON.parse(cleanedResponse);
      const validatedQuestion = QuestionSchema.parse(parsed);

      questions.push(validatedQuestion);
      console.log(`Successfully generated question for skill: ${skill}`);

    } catch (error: any) {
      console.error(`Error generating or parsing question for skill "${skill}":`, error?.message || error);
      // Fallback: Insert placeholder question
      questions.push({
        questionText: `Placeholder question for ${skill}: Describe your experience with ${skill}.`,
        skillTested: skill,
      });
    }
  }

  // Validate overall result
  if (questions.length !== input.skills.length) {
    console.warn(`Mismatch: Expected ${input.skills.length} questions but got ${questions.length}.`);
  }

  if (questions.length === 0) {
    console.error("No questions generated. Returning empty test.");
    return {
      testId,
      instructions: 'Error: Could not generate test questions. Please try again later.',
      questions: [],
    };
  }

  return {
    testId,
    instructions: 'Please answer the following questions carefully to demonstrate your skills.',
    questions,
  };
}
