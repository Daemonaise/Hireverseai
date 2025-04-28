

/**
 * @fileOverview Generates a single adaptive assessment question.
 * Uses the default Google AI model.
 *
 * Exports:
 * - generateAssessmentQuestion - A function that generates one question.
 */

import { ai } from '@/ai/ai-instance'; // Import the configured 'ai' instance
import { z } from 'genkit';
import {
    GenerateAssessmentQuestionInputSchema,
    type GenerateAssessmentQuestionInput,
    GenerateAssessmentQuestionOutputSchema,
    type GenerateAssessmentQuestionOutput, // Export output type
    DifficultyLevelSchema,
    type DifficultyLevel,
} from '@/ai/schemas/generate-assessment-question-schema';

// Define an internal schema that includes the timestamp for the prompt
const PromptInputSchema = GenerateAssessmentQuestionInputSchema.extend({
    timestamp: z.number(),
});

// Define the prompt structure outside the flow
const questionPromptDefinition = ai.definePrompt({
    name: `adaptiveQuestionPrompt`, // Generic name
    input: { schema: PromptInputSchema }, // Use internal schema with timestamp
    output: { schema: GenerateAssessmentQuestionOutputSchema },
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
        temperature: 0.7, // Moderate temperature for creative but relevant questions
    },
     // Model defaults to the one configured in ai-instance.ts
});

// 'use server'; - Not needed here, it's a standard async function
export async function generateAssessmentQuestion(input: GenerateAssessmentQuestionInput): Promise<GenerateAssessmentQuestionOutput> {
  return generateAssessmentQuestionFlow(input);
}


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
    console.log(`Generating assessment question for skill "${input.primarySkill}" (Difficulty: ${input.difficulty}) using default model`);

    try {
        // Add a timestamp to the input for potential use in the questionId generation within the prompt
        const inputWithTimestamp = { ...input, timestamp: Date.now() };

        // Call the prompt definition using the default model
        const { output } = await questionPromptDefinition(
            inputWithTimestamp
            // No model override needed
        );


        if (!output || !output.questionText || !output.questionId) {
             console.error("Failed to generate valid question output:", output);
             throw new Error(`Failed to generate a valid question for skill ${input.primarySkill} at difficulty ${input.difficulty}.`);
        }

        // Ensure the output matches the requested skill and difficulty (model might hallucinate)
        output.skillTested = input.primarySkill;
        output.difficulty = input.difficulty;


        console.log(`Generated question ${output.questionId} for skill ${input.primarySkill}`);
        return output;

    } catch (error: any) {
         console.error(`Error in generateAssessmentQuestionFlow for skill ${input.primarySkill}:`, error);
         if (error.message?.includes('API key')) {
             console.error(`Ensure your GOOGLE_API_KEY is valid and has permissions.`);
         } else if (error.message?.includes('INVALID_ARGUMENT')) {
             console.error(`Invalid argument error generating question for skill ${input.primarySkill}. Check prompt/schema. Error:`, error.details);
         }
         // Provide more specific error message
         const errorMessage = error instanceof Error ? error.message : String(error);
         throw new Error(`Error generating assessment question for skill ${input.primarySkill}: ${errorMessage}`);
    }
  }
);
