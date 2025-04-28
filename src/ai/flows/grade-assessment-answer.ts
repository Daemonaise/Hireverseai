

/**
 * @fileOverview Grades a single answer from an adaptive assessment.
 * Uses the default Google AI model.
 * Includes checks for AI generation and other flags.
 *
 * Exports:
 * - gradeAssessmentAnswer - A function that grades one answer.
 */

import { ai } from '@/ai/ai-instance'; // Import the configured 'ai' instance
import { z } from 'genkit';
import {
    GradeAssessmentAnswerInputSchema,
    type GradeAssessmentAnswerInput, // Keep type import for internal use
    GradeAssessmentAnswerOutputSchema,
    type GradeAssessmentAnswerOutput, // Export output type
    AnswerFlagsSchema, // Import for type usage
    type AnswerFlags, // Import type only
} from '@/ai/schemas/grade-assessment-answer-schema'; // Import schemas/types

// Define the prompt structure outside the flow
const gradingPromptDefinition = ai.definePrompt({
    name: `adaptiveGradingPrompt`, // Generic name
    input: { schema: GradeAssessmentAnswerInputSchema },
    output: { schema: GradeAssessmentAnswerOutputSchema },
    prompt: `You are an AI expert evaluating a freelancer's answer during an adaptive skill assessment.
Freelancer ID: {{{freelancerId}}}
Primary Skill for Assessment: {{{primarySkill}}}

Question (ID: {{{questionId}}}):
Skill Tested: {{{skillTested}}}
Difficulty: {{{difficulty}}}
Text: {{{questionText}}}

Freelancer's Answer:
{{{answerText}}}

Evaluate the answer based on accuracy, completeness, clarity, relevance, and demonstration of the "{{{skillTested}}}" skill at the "{{{difficulty}}}" level.
Assign a score from 0 to 100.
Provide specific, constructive feedback explaining the score.
Analyze the answer for potential issues. If applicable, include flags from this list: [${Object.values(AnswerFlagsSchema.Values).join(', ')}]. Only include flags if there is strong evidence.
Based on the score and quality of this answer, suggest the difficulty for the *next* question: 'easier' (if struggled significantly, score < 40), 'same' (if adequate or good, score 40-85), or 'harder' (if excellent, score > 85).

Return the result strictly following the output schema with 'questionId', 'score', 'feedback', optional 'flags', and 'suggestedNextDifficulty'. The 'questionId' MUST match the input "{{{questionId}}}".`,
    config: {
        temperature: 0.3, // Lower temperature for more objective grading
    },
     // Model defaults to the one configured in ai-instance.ts
});

// 'use server'; - Not needed here, it's a standard async function
export async function gradeAssessmentAnswer(input: GradeAssessmentAnswerInput): Promise<GradeAssessmentAnswerOutput> {
  return gradeAssessmentAnswerFlow(input);
}


const gradeAssessmentAnswerFlow = ai.defineFlow<
  typeof GradeAssessmentAnswerInputSchema,
  typeof GradeAssessmentAnswerOutputSchema
>(
  {
    name: 'gradeAssessmentAnswerFlow',
    inputSchema: GradeAssessmentAnswerInputSchema,
    outputSchema: GradeAssessmentAnswerOutputSchema,
  },
  async (input) => {
    console.log(`Grading answer for question ${input.questionId} (Skill: ${input.skillTested}, Difficulty: ${input.difficulty}) using default model`);

    try {
         // Call the prompt definition using the default model
        const { output } = await gradingPromptDefinition(
            input
            // No model override needed
        );


        if (!output || typeof output.score !== 'number' || !output.feedback || !output.suggestedNextDifficulty) {
             console.error("Failed to generate valid grading output:", output);
             throw new Error(`Failed to grade the answer for question ${input.questionId}. Invalid output received.`);
        }

         // Ensure the questionId matches the input
         output.questionId = input.questionId;

        console.log(`Graded question ${output.questionId}. Score: ${output.score}, Next Difficulty Suggestion: ${output.suggestedNextDifficulty}`);
        return output;

    } catch (error: any) {
         console.error(`Error in gradeAssessmentAnswerFlow for question ${input.questionId}:`, error);
          if (error.message?.includes('API key')) {
             console.error(`Ensure your GOOGLE_API_KEY is valid and has permissions.`);
         } else if (error.message?.includes('INVALID_ARGUMENT')) {
             console.error(`Invalid argument error grading answer for question ${input.questionId}. Check prompt/schema. Error:`, error.details);
         }
         // Provide more specific error message
          const errorMessage = error instanceof Error ? error.message : String(error);
         throw new Error(`Error grading assessment answer for question ${input.questionId}: ${errorMessage}`);
    }
  }
);
