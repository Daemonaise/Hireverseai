'use server';
/**
 * @fileOverview Generates skill test questions for freelancers based on their selected skills.
 *
 * Exports:
 * - administerSkillTest - Generates and returns test questions.
 */
import { ai, chooseModelBasedOnPrompt } from '@/lib/ai'; // Import the configured ai instance and helpers
import { validateAIOutput } from '@/ai/validate-output'; // Import from new location
import { z } from 'zod';
import {
  AdministerSkillTestInputSchema,
  type AdministerSkillTestInput,
  AdministerSkillTestOutputSchema,
  type AdministerSkillTestOutput,
  QuestionSchema,
  type Question,
} from '@/ai/schemas/administer-skill-test-schema';
// Removed unused schema import
// import { SingleSkillScoreAIOutputSchema } from '@/ai/schemas/score-skill-test-schema';

// Export types separately
export type { AdministerSkillTestInput, AdministerSkillTestOutput, Question };


// --- Define the Prompt Template (without model) ---
const SingleQuestionInputSchema = z.object({
  skill: z.string(),
  freelancerId: z.string(),
});
const SingleQuestionOutputSchema = z.object({
  questionText: z.string().min(10), // Expecting just the question text from AI
});

const skillQuestionPromptTemplate = `You are an AI hiring assistant specializing in creating skill assessment questions.
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
Do NOT add any extra explanations outside the JSON object. Ensure 'questionText' is at least 10 characters long.`;


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

        // 1. Choose the primary model for generation
        const primaryModel = await chooseModelBasedOnPrompt(`Generate skill test question for: ${skill}`);
        console.log(`Using model ${primaryModel} for generation.`);

        // 2. Define the prompt using the chosen model and template
        const skillQuestionPrompt = ai.definePrompt({
          name: `skillQuestionPrompt_${skill}_${primaryModel.replace(/[^a-zA-Z0-9]/g, '_')}`, // Dynamic name
          input: { schema: SingleQuestionInputSchema },
          output: { schema: SingleQuestionOutputSchema },
          prompt: skillQuestionPromptTemplate,
          model: primaryModel, // Set the chosen model
        });

        // 3. Generate the initial question
        const promptInput = { skill, freelancerId: input.freelancerId };
        const { output: aiOutput } = await skillQuestionPrompt(promptInput);

        if (!aiOutput?.questionText) {
            throw new Error(`AI (${primaryModel}) did not return valid question text for skill "${skill}".`);
        }

        // 4. Validate the output with other models
         const originalPromptText = skillQuestionPromptTemplate
              .replace('{{{skill}}}', skill)
              .replace('{{{freelancerId}}}', input.freelancerId);

          const validation = await validateAIOutput(originalPromptText, JSON.stringify(aiOutput), primaryModel);

          if (!validation.allValid) {
              console.warn(`Validation failed for question generation (skill: ${skill}). Reasoning:`, validation.results);
              // Optionally, retry or use fallback
              throw new Error(`Question generation for skill "${skill}" failed cross-validation.`);
          }


        // 5. Construct and add the validated question
        const validatedQuestion: Question = {
          questionText: aiOutput.questionText,
          skillTested: skill, // Ensure the skillTested field is correctly set
        };

        questions.push(validatedQuestion);
        console.log(`Successfully generated and validated question for skill: ${skill}`);

      } catch (error: any) {
        console.error(`Error generating or validating question for skill "${skill}":`, error?.message || error);
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
