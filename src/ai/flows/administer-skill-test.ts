'use server';
/**
 * @fileOverview Generates skill test questions for freelancers based on their selected skills.
 * Uses dynamic model selection based on the skill.
 *
 * Exports:
 * - administerSkillTest - A function that generates test questions.
 */

import { ai, chooseModelBasedOnPrompt } from '@/ai/ai-instance'; // Import chooseModelBasedOnPrompt
import { z } from 'genkit';
import {
  AdministerSkillTestInputSchema, // Import schema definition
  type AdministerSkillTestInput, // Export type only
  AdministerSkillTestOutputSchema, // Import schema definition
  type AdministerSkillTestOutput, // Export type only
  QuestionSchema, // Import schema definition
  type Question, // Export type only
} from '@/ai/schemas/administer-skill-test-schema';

// Define the prompt structure generator function - returns a prompt definition
// This allows setting the model dynamically per skill.
// Keep internal, do not export
const createSkillQuestionPrompt = (modelName: string) => ai.definePrompt({
    name: `skillQuestionPrompt_${modelName.replace(/[^a-zA-Z0-9]/g, '_')}`, // Dynamic name based on model
    input: { schema: z.object({ skill: z.string(), freelancerId: z.string() }) },
    output: { schema: QuestionSchema }, // Expect a single Question object
    model: modelName, // Use the dynamically selected model
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
});

// Export only the async wrapper function and types
export type { AdministerSkillTestInput, AdministerSkillTestOutput, Question };

export async function administerSkillTest(input: AdministerSkillTestInput): Promise<AdministerSkillTestOutput> {
  return administerSkillTestFlow(input);
}

// Keep internal, do not export
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
    const generationPromises: Promise<void>[] = [];

    console.log(`Generating test for Freelancer ${input.freelancerId} with skills: ${input.skills.join(', ')} using dynamic model selection.`);

    for (const skill of input.skills) {
        const generateQuestionForSkill = async () => {
            try {
                // Choose the model based on the skill - Await the async function
                const selectedModel = await chooseModelBasedOnPrompt(skill);
                console.log(`Generating question for skill: ${skill} using model: ${selectedModel}`);

                // Create the specific prompt definition for this skill and model
                const skillQuestionPrompt = createSkillQuestionPrompt(selectedModel);

                // Call the dynamically created prompt definition
                const { output: question } = await skillQuestionPrompt(
                    { skill: skill, freelancerId: input.freelancerId }
                );

                if (question && question.questionText && question.skillTested) {
                    question.skillTested = skill; // Ensure correct skill is set
                    questions.push(question);
                    console.log(`Successfully generated question for skill: ${skill} using ${selectedModel}`);
                } else {
                    console.warn(`Failed to generate a valid question for skill: ${skill} using ${selectedModel}. Output received:`, question);
                    questions.push({ questionText: `Placeholder question for ${skill} - generation failed. Describe your experience with ${skill}.`, skillTested: skill });
                }
            } catch (error: any) {
                console.error(`Error generating question for skill "${skill}":`, error);
                if (error.message?.includes('API key')) {
                    console.error(`Ensure your GOOGLE_API_KEY (or other configured keys) is valid and has permissions.`);
                } else if (error.message?.includes('INVALID_ARGUMENT')) {
                     console.error(`Invalid argument error for skill "${skill}". Check prompt/schema. Error:`, error.details);
                }
                questions.push({ questionText: `Placeholder question for skill ${skill} - error during generation. Describe your experience with ${skill}.`, skillTested: skill });
            }
        };
        generationPromises.push(generateQuestionForSkill());
    }

    await Promise.all(generationPromises);

    if (questions.length !== input.skills.length) {
        console.warn(`Expected ${input.skills.length} questions, but generated ${questions.length}. Some generations might have failed.`);
    }

    if (questions.length === 0 && input.skills.length > 0) {
        console.error("Failed to generate any skill test questions for skills:", input.skills.join(', '));
        return {
            testId: testId,
            instructions: 'Error: Could not generate test questions at this time.',
            questions: [],
        };
    }

    const finalOutput: AdministerSkillTestOutput = {
        testId: testId,
        instructions: 'Please answer the following questions to the best of your ability, demonstrating your skills.',
        questions: questions,
    };

    return finalOutput;
  }
);
