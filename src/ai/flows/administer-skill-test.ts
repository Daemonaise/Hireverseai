

/**
 * @fileOverview Generates skill test questions for freelancers based on their selected skills.
 * Uses the default Google AI model.
 *
 * Exports:
 * - administerSkillTest - A function that generates test questions.
 */

import { ai } from '@/ai/ai-instance'; // Import the configured 'ai' instance
import { z } from 'genkit';
import {
  AdministerSkillTestInputSchema,
  type AdministerSkillTestInput,
  AdministerSkillTestOutputSchema,
  QuestionSchema,
  type Question,
} from '@/ai/schemas/administer-skill-test-schema';

// Define the prompt structure outside the loop
const skillQuestionPromptDefinition = ai.definePrompt({
    name: `skillQuestionPrompt`, // Generic name
    input: { schema: z.object({ skill: z.string(), freelancerId: z.string() }) },
    output: { schema: QuestionSchema }, // Expect a single Question object
    prompt: `You are an expert AI hiring assistant specializing in creating skill assessment questions.
Generate exactly ONE practical and relevant test question for a freelancer (ID: {{{freelancerId}}}) claiming to have the following skill: {{{skill}}}.
The question should effectively probe their proficiency in this specific skill. Ensure the output only contains the questionText and the skillTested ("{{{skill}}}").
Focus on scenarios, problem-solving, or conceptual understanding relevant to the skill.
For visual skills like 'Graphic Design' or 'UI/UX Design', ask them to describe a process, critique a hypothetical design, or explain how they would approach a specific visual task. Avoid asking for file uploads.
For technical skills like 'Web Development (React)', provide a small code snippet to analyze or ask about a specific concept.
For writing skills like 'Copywriting', ask them to write a short piece or critique a sample text.
Output format MUST follow the provided schema with 'questionText' and 'skillTested'.`,
    config: {
        temperature: 0.7, // Adjust creativity/focus as needed
    }
    // Model defaults to the one configured in ai-instance.ts (gemini-1.5-flash-latest)
});

// 'use server'; - This is not required here as it's a standard async function
export async function administerSkillTest(input: AdministerSkillTestInput): Promise<z.infer<typeof AdministerSkillTestOutputSchema>> {
  return administerSkillTestFlow(input);
}

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
    const questions: Question[] = []; // Use the imported Question type
    const generationPromises: Promise<void>[] = []; // Store promises for concurrent generation

    console.log(`Generating test for Freelancer ${input.freelancerId} with skills: ${input.skills.join(', ')} using default model.`);

    for (const skill of input.skills) {
        // Define the generation task as an async function
        const generateQuestionForSkill = async () => {
            try {
                console.log(`Generating question for skill: ${skill}`);

                // Call the prompt definition using the default model
                const { output: question } = await skillQuestionPromptDefinition(
                    { skill: skill, freelancerId: input.freelancerId }
                    // No model override needed, uses default from 'ai' instance
                );

                if (question && question.questionText && question.skillTested) {
                    // Ensure the skillTested matches the input skill, sometimes models might hallucinate
                    question.skillTested = skill;
                    questions.push(question);
                    console.log(`Successfully generated question for skill: ${skill}`);
                } else {
                    console.warn(`Failed to generate a valid question for skill: ${skill}. Output received:`, question);
                    // Optionally, add a default placeholder question or skip
                     questions.push({ questionText: `Placeholder question for ${skill} - generation failed. Describe your experience with ${skill}.`, skillTested: skill });
                }
            } catch (error: any) {
                console.error(`Error generating question for skill "${skill}":`, error);
                 if (error.message?.includes('API key')) {
                    console.error(`Ensure your GOOGLE_API_KEY is valid and has permissions.`);
                 } else if (error.message?.includes('INVALID_ARGUMENT')) {
                     console.error(`Invalid argument error for skill "${skill}". Check prompt/schema. Error:`, error.details);
                 }
                // Optionally, add a default placeholder question or skip
                questions.push({ questionText: `Placeholder question for ${skill} - error during generation. Describe your experience with ${skill}.`, skillTested: skill });
            }
        };
        // Add the promise to the array
        generationPromises.push(generateQuestionForSkill());
    }

    // Wait for all question generation promises to complete
    await Promise.all(generationPromises);

    // Ensure we have the expected number of questions, even if some failed
    if (questions.length !== input.skills.length) {
        console.warn(`Expected ${input.skills.length} questions, but generated ${questions.length}. Some generations might have failed.`);
        // Potentially add more placeholders if needed, though the catch blocks should handle this.
    }

     if (questions.length === 0 && input.skills.length > 0) {
        console.error("Failed to generate any skill test questions for skills:", input.skills.join(', '));
        // Consider returning an error or an empty test with a specific message
        // throw new Error("Failed to generate any skill test questions.");
         return {
            testId: testId,
            instructions: 'Error: Could not generate test questions at this time.',
            questions: [],
        };
    }

    // Structure the final output
    const finalOutput: z.infer<typeof AdministerSkillTestOutputSchema> = {
        testId: testId,
        instructions: 'Please answer the following questions to the best of your ability, demonstrating your skills.',
        questions: questions,
    };

    return finalOutput;
  }
);
