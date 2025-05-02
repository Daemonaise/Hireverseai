'use server';

/**
 * @fileOverview Grades a single answer from an adaptive assessment.
 * Uses dynamic model selection via callAI.
 */

import { callAI } from '@/ai/ai-instance'; // Import the centralized callAI function
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
  // Validate input
  GradeAssessmentAnswerInputSchema.parse(input);

  console.log(`Grading answer for question ${input.questionId} (Skill: ${input.skillTested}, Difficulty: ${input.difficulty})...`);

  const allowedFlags = `[${Object.values(AnswerFlagsSchema.enum).join(', ')}]`; // Access enum values correctly

  // Construct the prompt for the callAI function
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
{
  "score": Integer (0-100),
  "feedback": String (concise and specific),
  "flags": [Optional: flags from ${allowedFlags}],
  "suggestedNextDifficulty": "easier" | "same" | "harder"
}

IMPORTANT: Do NOT include any explanatory text or extra formatting. Only output the JSON object. Ensure score is between 0 and 100.`;


  try {
    // Call the centralized AI function
    const responseText = await callAI(promptText);

    // Attempt to parse the JSON response
    let aiOutput: Omit<GradeAssessmentAnswerOutput, 'questionId'>;
    try {
        // Basic JSON extraction
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON object found in response.");
        const rawOutput = JSON.parse(jsonMatch[0]);

        // Validate the parsed output structure against the schema (excluding questionId)
        const validationResult = GradeAssessmentAnswerOutputSchema.omit({ questionId: true }).safeParse(rawOutput);
        if (!validationResult.success) {
            throw new Error(`Invalid JSON structure: ${validationResult.error.errors.map(e => e.message).join(', ')}`);
        }
        aiOutput = validationResult.data; // Use validated data

        // Ensure score is within bounds
         if (aiOutput.score < 0 || aiOutput.score > 100) {
             console.warn(`AI returned score (${aiOutput.score}) outside 0-100 range. Clamping.`);
             aiOutput.score = Math.max(0, Math.min(100, aiOutput.score));
         }


    } catch (parseError: any) {
        console.error(`Error parsing grading JSON for question ${input.questionId}:`, parseError.message, "Raw Response:", responseText);
        throw new Error(`AI did not return valid JSON grading output.`);
    }


    // Construct the full output object, adding the questionId back
    const finalOutput: GradeAssessmentAnswerOutput = {
      ...aiOutput,
      questionId: input.questionId,
    };

    // Validate the final constructed output (optional but recommended)
    GradeAssessmentAnswerOutputSchema.parse(finalOutput);

    console.log(`Successfully graded question ${finalOutput.questionId}. Score: ${finalOutput.score}`);
    return finalOutput;

  } catch (error: any) {
    // Catch errors from callAI or parsing/validation
    console.error(`Grading error for question ${input.questionId}:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Propagate the error to the caller
    throw new Error(`Failed to grade answer for question ${input.questionId}: ${errorMessage}`);
  }
}
    
