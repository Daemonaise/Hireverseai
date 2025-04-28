
'use server';
/**
 * @fileOverview Grades a single answer from an adaptive assessment.
 * Uses dynamic model selection based on the skill tested.
 * Includes checks for AI generation and other flags.
 *
 * Exports:
 * - gradeAssessmentAnswer - A function that grades one answer.
 * - GradeAssessmentAnswerInput - Input type.
 * - GradeAssessmentAnswerOutput - Output type.
 * - AnswerFlags - Enum for potential flags.
 */

// Correctly import from the ai-instance module
import { chooseModelBasedOnPrompt, callAI } from '@/ai/ai-instance';
import { z } from 'zod'; // Use standard zod import
import {
    GradeAssessmentAnswerInputSchema,
    type GradeAssessmentAnswerInput,
    GradeAssessmentAnswerOutputSchema,
    type GradeAssessmentAnswerOutput,
    AnswerFlagsSchema,
    type AnswerFlags,
} from '@/ai/schemas/grade-assessment-answer-schema';

// Export types
export type { GradeAssessmentAnswerInput, GradeAssessmentAnswerOutput, AnswerFlags };

// Main exported function
export async function gradeAssessmentAnswer(input: GradeAssessmentAnswerInput): Promise<GradeAssessmentAnswerOutput> {
    try {
        // 1. Choose model
        // Correctly use the imported function
        const selectedModel = chooseModelBasedOnPrompt(input.skillTested);
        console.log(`Grading answer for question ${input.questionId} (Skill: ${input.skillTested}, Difficulty: ${input.difficulty}) using model: ${selectedModel}`);

        // 2. Construct prompt
        const allowedFlags = `[${Object.values(AnswerFlagsSchema.Values).join(', ')}]`;
        const schemaDescription = `{
  "questionId": "${input.questionId}",
  "score": "Integer score from 0 to 100",
  "feedback": "Specific, constructive feedback explaining the score.",
  "flags": ["Optional: List of flags found, if any, from ${allowedFlags}"],
  "suggestedNextDifficulty": "'easier' (score < 40), 'same' (score 40-85), or 'harder' (score > 85)"
}`;

        const promptText = `You are an AI expert evaluating a freelancer's answer during an adaptive skill assessment.
Freelancer ID: ${input.freelancerId}
Primary Skill for Assessment: ${input.primarySkill}

Question (ID: ${input.questionId}):
Skill Tested: ${input.skillTested}
Difficulty: ${input.difficulty}
Text: ${input.questionText}

Freelancer's Answer:
${input.answerText}

Evaluate the answer based on accuracy, completeness, clarity, relevance, and demonstration of the "${input.skillTested}" skill at the "${input.difficulty}" level.
Assign a score from 0 to 100.
Provide specific, constructive feedback explaining the score.
Analyze the answer for potential issues. If applicable, include flags from this list: ${allowedFlags}. Only include flags if there is strong evidence.
Based on the score and quality of this answer, suggest the difficulty for the *next* question: 'easier' (if struggled significantly, score < 40), 'same' (if adequate or good, score 40-85), or 'harder' (if excellent, score > 85).

Return ONLY a JSON object strictly following this structure:
${schemaDescription}
The 'questionId' MUST match the input "${input.questionId}".
Do not include any explanations or introductory text outside the JSON object.`;

        // 3. Call AI using the unified function
        const responseString = await callAI(selectedModel, promptText);

        // 4. Parse and validate response
        try {
            // Clean potential markdown code block fences
            const cleanedResponse = responseString.replace(/^```json\n?/, '').replace(/\n?```$/, '');
            const parsed = JSON.parse(cleanedResponse);
            const output = GradeAssessmentAnswerOutputSchema.parse(parsed);

            if (!output || typeof output.score !== 'number' || !output.feedback || !output.suggestedNextDifficulty) {
                console.error(`AI (${selectedModel}) failed to generate valid grading output:`, output, "Raw:", responseString);
                throw new Error(`Failed to grade the answer using ${selectedModel} for question ${input.questionId}. Invalid output received.`);
            }

            // Ensure questionId matches input
            output.questionId = input.questionId;

            console.log(`Graded question ${output.questionId} using ${selectedModel}. Score: ${output.score}, Next Difficulty Suggestion: ${output.suggestedNextDifficulty}`);
            return output;

        } catch (parseError: any) {
            console.error(`Error parsing/validating AI grading response for question ${input.questionId} using ${selectedModel}:`, parseError.errors ?? parseError, "Raw Response:", responseString);
            throw new Error(`AI (${selectedModel}) returned an invalid response structure during grading.`);
        }

    } catch (error: any) {
        console.error(`Error grading assessment answer for question ${input.questionId}:`, error);
        // Throw error to be caught by the caller
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Error grading assessment answer for question ${input.questionId}: ${errorMessage}`);
    }
}
