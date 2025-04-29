'use server';

/**
 * @fileOverview Grades a single answer from an adaptive assessment.
 * Dynamically chooses the best AI model based on the skill tested.
 */

import { callAI } from '@/ai/ai-instance';
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
export async function gradeAssessmentAnswer(input: GradeAssessmentAnswerInput): Promise<GradeAssessmentAnswerOutput> {
  try {
    const selectedModel = chooseModelBasedOnPrompt(input.skillTested);
    console.log(`Grading answer for question ${input.questionId} (Skill: ${input.skillTested}, Difficulty: ${input.difficulty}) using model: ${selectedModel}`);

    const allowedFlags = `[${Object.values(AnswerFlagsSchema.options).join(', ')}]`;
    const schemaDescription = `{
  "questionId": "${input.questionId}",
  "score": Integer (0-100),
  "feedback": String (concise and specific),
  "flags": [Optional: flags from ${allowedFlags}],
  "suggestedNextDifficulty": "easier" | "same" | "harder"
}`;

    const promptText = `You are an expert AI evaluator grading a freelancer's skill test answer.

Freelancer ID: ${input.freelancerId}
Primary Skill for Assessment: ${input.primarySkill}

Question (ID: ${input.questionId}):
Skill Tested: ${input.skillTested}
Difficulty: ${input.difficulty}
Question Text: ${input.questionText}

Freelancer's Answer:
${input.answerText}

Instructions:
- Score the answer 0–100 based on accuracy, completeness, clarity, relevance, and level-appropriateness.
- Provide a short but specific feedback comment.
- If problems are found, flag them using ONLY flags from: ${allowedFlags}.
- Suggest the difficulty for the NEXT question:
  - "easier" (if score < 40)
  - "same" (if score 40–85)
  - "harder" (if score > 85)

STRICT OUTPUT: Return ONLY a JSON object matching this schema exactly:
${schemaDescription}

IMPORTANT: Do NOT include any explanatory text or extra formatting. Only output the JSON object.`;

    // Call AI
    const responseString = await callAI(selectedModel, promptText);

    try {
      const cleanedResponse = responseString.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      const parsed = JSON.parse(cleanedResponse);
      const output = GradeAssessmentAnswerOutputSchema.parse(parsed);

      if (!output || typeof output.score !== 'number' || !output.feedback || !output.suggestedNextDifficulty) {
        console.error(`Invalid AI grading output for question ${input.questionId}:`, output, "Raw:", responseString);
        throw new Error(`Invalid output from AI during grading.`);
      }

      // Force questionId to match input for safety
      output.questionId = input.questionId;

      console.log(`Successfully graded question ${output.questionId} using ${selectedModel}. Score: ${output.score}`);
      return output;

    } catch (parseError: any) {
      console.error(`Parsing/validation error for question ${input.questionId}:`, parseError.errors ?? parseError, "Raw Response:", responseString);
      throw new Error(`Parsing error in AI grading output.`);
    }

  } catch (error: any) {
    console.error(`Grading error for question ${input.questionId}:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to grade answer for question ${input.questionId}: ${errorMessage}`);
  }
}
