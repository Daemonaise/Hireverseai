'use server';

/**
 * @fileOverview Grades a single answer from an adaptive assessment.
 * Dynamically chooses the best AI model based on the skill tested.
 */

import { ai } from '@/ai/ai-instance'; // Import ai instance
import { chooseModelBasedOnPrompt } from '@/lib/model-selector';
import { z } from 'zod';
import {
  GradeAssessmentAnswerInputSchema,
  type GradeAssessmentAnswerInput,
  GradeAssessmentAnswerOutputSchema,
  type GradeAssessmentAnswerOutput,
  AnswerFlagsSchema,
  type AnswerFlags,
} from '@/ai/schemas/grade-assessment-answer-schema';

// Export types cleanly
export type { GradeAssessmentAnswerInput, GradeAssessmentAnswerOutput, AnswerFlags };

// --- Main grading function ---
// Export only the async function
export async function gradeAssessmentAnswer(input: GradeAssessmentAnswerInput): Promise<GradeAssessmentAnswerOutput> {
  // Validate input (optional, often handled by caller/framework)
  GradeAssessmentAnswerInputSchema.parse(input);

  try {
    // Determine model based on skill tested (uses centralized logic)
    const selectedModel = chooseModelBasedOnPrompt(input.skillTested);
    console.log(`Grading answer for question ${input.questionId} (Skill: ${input.skillTested}, Difficulty: ${input.difficulty}) using model: ${selectedModel}`);

    const allowedFlags = `[${Object.values(AnswerFlagsSchema.enum).join(', ')}]`; // Access enum values correctly

    // Define the Genkit prompt
    const gradeAnswerPrompt = ai.definePrompt({
        name: `gradeAnswer_${input.skillTested}_${input.difficulty}`,
        input: { schema: GradeAssessmentAnswerInputSchema },
        // AI only needs to output score, feedback, flags, and suggestion
        output: { schema: GradeAssessmentAnswerOutputSchema.omit({ questionId: true }) },
        model: selectedModel,
        prompt: `You are an expert AI evaluator grading a freelancer's skill test answer.

Freelancer ID: {{{freelancerId}}}
Primary Skill for Assessment: {{{primarySkill}}}

Question (ID: {{{questionId}}}):
Skill Tested: {{{skillTested}}}
Difficulty: {{{difficulty}}}
Question Text: {{{questionText}}}

Freelancer's Answer:
{{{answerText}}}

Instructions:
- Score the answer 0–100 based on accuracy, completeness, clarity, relevance, and level-appropriateness.
- Provide a short but specific feedback comment.
- If problems are found, flag them using ONLY flags from: ${allowedFlags}.
- Suggest the difficulty for the NEXT question:
  - "easier" (if score < 40)
  - "same" (if score 40–85)
  - "harder" (if score > 85)

STRICT OUTPUT: Return ONLY a JSON object matching this schema exactly:
{
  "score": Integer (0-100),
  "feedback": String (concise and specific),
  "flags": [Optional: flags from ${allowedFlags}],
  "suggestedNextDifficulty": "easier" | "same" | "harder"
}

IMPORTANT: Do NOT include any explanatory text or extra formatting. Only output the JSON object.`,
    });


    try {
      const { output: aiOutput } = await gradeAnswerPrompt(input);

      if (!aiOutput || typeof aiOutput.score !== 'number' || !aiOutput.feedback || !aiOutput.suggestedNextDifficulty) {
        throw new Error(`Invalid AI grading output structure for question ${input.questionId}.`);
      }

      // Construct the full output object, adding the questionId back
      const finalOutput: GradeAssessmentAnswerOutput = {
        ...aiOutput,
        questionId: input.questionId,
      };

      // Validate the final constructed output (optional but recommended)
      GradeAssessmentAnswerOutputSchema.parse(finalOutput);

      console.log(`Successfully graded question ${finalOutput.questionId} using ${selectedModel}. Score: ${finalOutput.score}`);
      return finalOutput;

    } catch (aiError: any) {
      console.error(`Parsing/validation error for question ${input.questionId}:`, aiError.errors ?? aiError, "Input:", input);
      // Throw a more specific error to be caught by the outer catch block
      throw new Error(`Invalid JSON structure in AI grading output.`);
    }

  } catch (error: any) {
    // Catch errors from prompt definition or execution
    console.error(`Grading error for question ${input.questionId}:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Propagate the error to the caller
    throw new Error(`Failed to grade answer for question ${input.questionId}: ${errorMessage}`);
  }
}
