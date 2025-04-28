'use server';
/**
 * @fileOverview Grades a single answer from an adaptive assessment.
 * Uses dynamic model selection based on the skill tested.
 * Includes checks for AI generation and other flags.
 *
 * Exports:
 * - gradeAssessmentAnswer - A function that grades one answer.
 */

import { ai, chooseModelBasedOnPrompt } from '@/ai/ai-instance'; // Import chooseModelBasedOnPrompt
import { z } from 'genkit';
import {
    GradeAssessmentAnswerInputSchema, // Import schema definition
    type GradeAssessmentAnswerInput, // Export type only
    GradeAssessmentAnswerOutputSchema, // Import schema definition
    type GradeAssessmentAnswerOutput, // Export type only
    AnswerFlagsSchema, // Import schema definition
    type AnswerFlags, // Export type only
} from '@/ai/schemas/grade-assessment-answer-schema';

// Define the prompt structure generator function
// Keep internal, do not export
const createGradingPrompt = (modelName: string) => ai.definePrompt({
    name: `adaptiveGradingPrompt_${modelName.replace(/[^a-zA-Z0-9]/g, '_')}`, // Dynamic name
    input: { schema: GradeAssessmentAnswerInputSchema },
    output: { schema: GradeAssessmentAnswerOutputSchema },
    model: modelName, // Use dynamically selected model
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
        temperature: 0.3,
    },
});

// Export only the async wrapper function and types
export type { GradeAssessmentAnswerInput, GradeAssessmentAnswerOutput, AnswerFlags };

export async function gradeAssessmentAnswer(input: GradeAssessmentAnswerInput): Promise<GradeAssessmentAnswerOutput> {
  return gradeAssessmentAnswerFlow(input);
}

// Keep internal, do not export
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
    // Choose model based on the skill tested in the question - Await the async function
    const selectedModel = await chooseModelBasedOnPrompt(input.skillTested);
    console.log(`Grading answer for question ${input.questionId} (Skill: ${input.skillTested}, Difficulty: ${input.difficulty}) using model: ${selectedModel}`);

    try {
        // Create the specific prompt definition
        const gradingPrompt = createGradingPrompt(selectedModel);

        // Call the dynamically created prompt
        const { output } = await gradingPrompt(input);

        if (!output || typeof output.score !== 'number' || !output.feedback || !output.suggestedNextDifficulty) {
             console.error(`Failed to generate valid grading output using ${selectedModel}:`, output);
             throw new Error(`Failed to grade the answer using ${selectedModel} for question ${input.questionId}. Invalid output received.`);
        }

         output.questionId = input.questionId;

        console.log(`Graded question ${output.questionId} using ${selectedModel}. Score: ${output.score}, Next Difficulty Suggestion: ${output.suggestedNextDifficulty}`);
        return output;

    } catch (error: any) {
         console.error(`Error in gradeAssessmentAnswerFlow for question ${input.questionId} using ${selectedModel}:`, error);
          if (error.message?.includes('API key')) {
             console.error(`Ensure your GOOGLE_API_KEY (or other configured keys) is valid and has permissions.`);
         } else if (error.message?.includes('INVALID_ARGUMENT')) {
             console.error(`Invalid argument error grading answer for question ${input.questionId} using ${selectedModel}. Check prompt/schema. Error:`, error.details);
         }
          const errorMessage = error instanceof Error ? error.message : String(error);
         throw new Error(`Error grading assessment answer for question ${input.questionId} with ${selectedModel}: ${errorMessage}`);
    }
  }
);
