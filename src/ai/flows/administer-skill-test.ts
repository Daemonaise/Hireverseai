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
import { ai } from '@/ai/ai-instance'; // Import the configured ai instance
import {
  AdministerSkillTestInputSchema,
  type AdministerSkillTestInput,
  AdministerSkillTestOutputSchema,
  type AdministerSkillTestOutput,
  QuestionSchema,
  type Question,
} from '@/ai/schemas/administer-skill-test-schema';
import { z } from 'zod';

// Only export the async function and related types
export type { AdministerSkillTestInput, AdministerSkillTestOutput, Question };

// --- Define the Prompt for a single question ---
const SingleQuestionInputSchema = z.object({
  skill: z.string(),
  freelancerId: z.string(),
});
const SingleQuestionOutputSchema = z.object({
  questionText: z.string().min(10), // Expecting just the question text from AI
});

const skillQuestionPrompt = ai.definePrompt({
  name: 'skillQuestionPrompt',
  input: { schema: SingleQuestionInputSchema },
  output: { schema: SingleQuestionOutputSchema },
  // model: 'googleai/gemini-1.5-flash', // Example: Specify model if needed
  prompt: `You are an AI hiring assistant specializing in creating skill assessment questions.
Generate exactly ONE practical and relevant test question for a freelancer (ID: {{{freelancerId}}}) claiming the following skill: {{{skill}}}.
The question should effectively probe their proficiency in this specific skill.

Focus on realistic scenarios:
- For visual skills (e.g., Graphic Design), ask to describe design processes or critique examples.
- For technical skills (e.g., React Development), ask conceptual or code analysis questions.
- For writing skills (e.g., Copywriting), ask to write or critique a short text.

Return ONLY a JSON object with:
{
  "questionText": "The test question."
}
Do NOT add any extra explanations outside the JSON object. Ensure 'questionText' is at least 10 characters long.`,
});

// --- Define the Flow ---
const administerSkillTestFlow = ai.defineFlow<
  typeof AdministerSkillTestInputSchema,
  typeof AdministerSkillTestOutputSchema
>(
  {
    name: 'administerSkillTestFlow',
    inputSchema: AdministerSkillTestInputSchema,
    outputSchema: AdministerSkillTestOutputSchema,
  },
  async (input) => {
    const testId = `test_${input.freelancerId}_${Date.now()}`;
    const questions: Question[] = [];

    console.log(`Generating skill test for Freelancer ${input.freelancerId} with skills: ${input.skills.join(', ')}`);

    // Loop through each skill and generate a question
    for (const skill of input.skills) {
      try {
        console.log(`Generating question for skill: ${skill}...`);

        // Call the defined prompt for the current skill
        const { output: aiOutput } = await skillQuestionPrompt({ skill, freelancerId: input.freelancerId });

        if (!aiOutput?.questionText) {
            throw new Error(`AI did not return valid question text for skill "${skill}".`);
        }

        // Manually construct the full Question object
        const validatedQuestion: Question = {
          questionText: aiOutput.questionText,
          skillTested: skill, // Ensure the skillTested field is correctly set
        };

        questions.push(validatedQuestion);
        console.log(`Successfully generated question for skill: ${skill}`);

      } catch (error: any) {
        console.error(`Error generating or processing question for skill "${skill}":`, error?.message || error);
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
      // This might happen if errors occurred for some skills
    }

    if (questions.length === 0) {
      console.error("No questions generated. Returning empty test.");
      return {
        testId,
        instructions: 'Error: Could not generate test questions. Please try again later.',
        questions: [],
      };
    }

    // Construct the final output adhering to the schema
    const output: AdministerSkillTestOutput = {
      testId,
      instructions: 'Please answer the following questions carefully to demonstrate your skills.',
      questions,
    };

    // Validate the final output before returning (optional but good practice)
    AdministerSkillTestOutputSchema.parse(output);

    return output;
  }
);


// --- Main Exported Function (Wrapper) ---
export async function administerSkillTest(input: AdministerSkillTestInput): Promise<AdministerSkillTestOutput> {
  // Validation is implicitly handled by Zod schema in the Flow definition,
  // but can be done here too for immediate feedback if called directly.
  AdministerSkillTestInputSchema.parse(input);
  return administerSkillTestFlow(input);
}
