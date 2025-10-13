'use server';
/**
 * @fileOverview Generates scenario-rich skill test questions for freelancers based on their selected skills.
 *
 * Exports:
 * - administerSkillTest - Generates and returns test questions (async function).
 */
import { ai } from '@/lib/ai';
import { chooseModelBasedOnPrompt } from '@/lib/ai-server-helpers';
import { z } from 'zod';
import {
  AdministerSkillTestInputSchema,
  type AdministerSkillTestInput,
  AdministerSkillTestOutputSchema,
  type AdministerSkillTestOutput,
  type Question,
} from '@/ai/schemas/administer-skill-test-schema';

const SingleQuestionInputSchema = z.object({
  skill: z.string(),
  freelancerId: z.string(),
});
const SingleQuestionOutputSchema = z.object({
  questionText: z.string().min(10),
});

const skillQuestionPromptTemplate = `You are an imaginative AI hiring assistant crafting engaging, scenario-driven skill assessment questions.
Add a creative or real-world twist to probe mastery. Generate exactly ONE practical, vivid, and relevant test question for a freelancer (ID: {{{freelancerId}}}) claiming the skill: {{{skill}}}.
Include a scenario or problem statement that feels authentic—use a client context, data samples, or visual cues.

Return ONLY a JSON object:
{
  "questionText": "The test question with scenario."
}
Do NOT include any extra text outside the JSON object. Ensure 'questionText' is at least 10 characters long.`;

const administerSkillTestFlow = ai.defineFlow(
  {
    name: 'administerSkillTestFlow',
    inputSchema: AdministerSkillTestInputSchema,
    outputSchema: AdministerSkillTestOutputSchema,
  },
  async (input) => {
    const testId = `test_${input.freelancerId}_${Date.now()}`;
    const questions: Question[] = [];

    console.log(
      `Generating skill test for ${input.freelancerId}: ${input.skills.join(
        ', ',
      )}`,
    );

    for (const skill of input.skills) {
      try {
        console.log(`-> Generating for ${skill}`);
        const primaryModel = await chooseModelBasedOnPrompt(
          `Create skill question for: ${skill}`,
        );
        console.log(`Model: ${primaryModel.name}`);

        const skillQuestionPrompt = ai.definePrompt({
          name: `skillQuestionPrompt_${skill}`,
          input: { schema: SingleQuestionInputSchema },
          output: { schema: SingleQuestionOutputSchema },
          prompt: skillQuestionPromptTemplate,
          model: primaryModel,
        });

        const { output: aiOutput } = await skillQuestionPrompt({
          skill,
          freelancerId: input.freelancerId,
        });
        if (!aiOutput?.questionText) throw new Error('No question returned.');

        const originalPromptText = skillQuestionPromptTemplate
          .replace('{{{skill}}}', skill)
          .replace('{{{freelancerId}}}', input.freelancerId);
        

        questions.push({
          questionText: aiOutput.questionText,
          skillTested: skill,
        });
        console.log(`✔ ${skill}`);
      } catch (err: any) {
        console.error(`Error for ${skill}:`, err.message);
        questions.push({
          questionText: `Placeholder for ${skill}: Describe a real-world scenario showcasing your expertise with ${skill}.`,
          skillTested: skill,
        });
      }
    }

    const instructions =
      'Answer each scenario-based question to demonstrate your skill mastery.';
    const output: AdministerSkillTestOutput = {
      testId,
      instructions,
      questions,
    };
    AdministerSkillTestOutputSchema.parse(output);
    return output;
  },
);

/**
 * Generates a skill test with scenario-based questions for a freelancer.
 *
 * @param {AdministerSkillTestInput} input - The input object containing the freelancer's ID and a list of skills to be tested.
 * @property {string} input.freelancerId - The unique identifier for the freelancer.
 * @property {string[]} input.skills - An array of skills to generate questions for.
 * @returns {Promise<AdministerSkillTestOutput>} A promise that resolves to the generated skill test, including a test ID, instructions, and an array of questions.
 * @throws {Error} Throws an error if the input validation fails.
 */
export async function administerSkillTest(
  input: AdministerSkillTestInput,
): Promise<AdministerSkillTestOutput> {
  AdministerSkillTestInputSchema.parse(input);
  return administerSkillTestFlow(input);
}
