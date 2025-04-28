'use server';
/**
 * @fileOverview Generates a single adaptive assessment question.
 * Uses dynamic model selection based on the primary skill.
 *
 * Exports:
 * - generateAssessmentQuestion - A function that generates one question.
 */

import { ai, chooseModelBasedOnPrompt } from '@/ai/ai-instance'; // Import chooseModelBasedOnPrompt
import { z } from 'genkit';
import {
    GenerateAssessmentQuestionInputSchema, // Import schema definition
    type GenerateAssessmentQuestionInput, // Export type only
    GenerateAssessmentQuestionOutputSchema, // Import schema definition
    type GenerateAssessmentQuestionOutput, // Export type only
    DifficultyLevelSchema, // Import schema definition
    type DifficultyLevel, // Export type only
} from '@/ai/schemas/generate-assessment-question-schema';

const PromptInputSchema = GenerateAssessmentQuestionInputSchema.extend({
    timestamp: z.number(),
});

// Define the prompt structure generator function
// Keep internal, do not export
const createQuestionPrompt = (modelName: string) => ai.definePrompt({
    name: `adaptiveQuestionPrompt_${modelName.replace(/[^a-zA-Z0-9]/g, '_')}`, // Dynamic name
    input: { schema: PromptInputSchema },
    output: { schema: GenerateAssessmentQuestionOutputSchema },
    model: modelName, // Use dynamically selected model
    prompt: `You are an AI expert creating adaptive assessment questions for freelancers.
Generate exactly ONE practical and relevant question for a freelancer (ID: {{{freelancerId}}}) based on their primary skill: {{{primarySkill}}}.
Consider their other claimed skills for context: {{#each allSkills}} - {{this}} {{/each}}.

The target difficulty level for this question is: {{{difficulty}}}.

{{#if previousQuestions}}
Avoid generating questions similar to these previous ones:
{{#each previousQuestions}}
- {{{this}}}
{{/each}}
{{/if}}

The question should effectively probe their proficiency in the primary skill at the specified difficulty level.
- For 'beginner', focus on basic concepts, definitions, or simple tasks.
- For 'intermediate', focus on common use cases, applying concepts, or troubleshooting simple problems.
- For 'advanced', focus on complex scenarios, optimization, design patterns, or nuanced understanding.
- For 'expert', focus on edge cases, architectural decisions, strategic thinking, or deep theoretical knowledge.

For visual skills (e.g., Graphic Design, UI/UX), ask for descriptions of processes, critiques, or approaches to specific tasks. Avoid asking for file uploads.
For technical skills (e.g., React, Python), provide code snippets to analyze, ask about specific concepts, or pose problem-solving challenges.
For writing skills (e.g., Copywriting), ask for short writing samples, critiques, or explanations of strategy.

Ensure the output strictly follows the schema:
- Generate a unique 'questionId' (e.g., "q_{{{freelancerId}}}_{{{timestamp}}}").
- 'questionText' should be the question itself.
- 'skillTested' must be exactly "{{{primarySkill}}}".
- 'difficulty' must be exactly "{{{difficulty}}}".
`,
    config: {
        temperature: 0.7,
    },
});

// Export only the async wrapper function and types
export type { GenerateAssessmentQuestionInput, GenerateAssessmentQuestionOutput, DifficultyLevel };

export async function generateAssessmentQuestion(input: GenerateAssessmentQuestionInput): Promise<GenerateAssessmentQuestionOutput> {
  return generateAssessmentQuestionFlow(input);
}

// Keep internal, do not export
const generateAssessmentQuestionFlow = ai.defineFlow<
  typeof GenerateAssessmentQuestionInputSchema,
  typeof GenerateAssessmentQuestionOutputSchema
>(
  {
    name: 'generateAssessmentQuestionFlow',
    inputSchema: GenerateAssessmentQuestionInputSchema,
    outputSchema: GenerateAssessmentQuestionOutputSchema,
  },
  async (input) => {
    // Choose model based on the primary skill being assessed - Await the async function
    const selectedModel = await chooseModelBasedOnPrompt(input.primarySkill);
    console.log(`Generating assessment question for skill "${input.primarySkill}" (Difficulty: ${input.difficulty}) using model: ${selectedModel}`);

    try {
        const inputWithTimestamp = { ...input, timestamp: Date.now() };

        // Create the specific prompt definition
        const questionPrompt = createQuestionPrompt(selectedModel);

        // Call the dynamically created prompt
        const { output } = await questionPrompt(inputWithTimestamp);

        if (!output || !output.questionText || !output.questionId) {
             console.error(`Failed to generate valid question output using ${selectedModel}:`, output);
             throw new Error(`Failed to generate a valid question using ${selectedModel} for skill ${input.primarySkill} at difficulty ${input.difficulty}.`);
        }

        output.skillTested = input.primarySkill;
        output.difficulty = input.difficulty;

        console.log(`Generated question ${output.questionId} for skill ${input.primarySkill} using ${selectedModel}`);
        return output;

    } catch (error: any) {
         console.error(`Error in generateAssessmentQuestionFlow for skill ${input.primarySkill} using ${selectedModel}:`, error);
         if (error.message?.includes('API key')) {
             console.error(`Ensure your GOOGLE_API_KEY (or other configured keys) is valid and has permissions.`);
         } else if (error.message?.includes('INVALID_ARGUMENT')) {
             console.error(`Invalid argument error generating question for skill ${input.primarySkill} using ${selectedModel}. Check prompt/schema. Error:`, error.details);
         }
         const errorMessage = error instanceof Error ? error.message : String(error);
         throw new Error(`Error generating assessment question for skill ${input.primarySkill} with ${selectedModel}: ${errorMessage}`);
    }
  }
);
