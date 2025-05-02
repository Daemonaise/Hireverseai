'use server';

/**
 * @fileOverview Grades a single answer from an adaptive assessment.
 */

import { ai } from '@/ai/ai-instance'; // Import the configured ai instance
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

// --- Define the Prompt ---
// Schema for AI's direct output (excluding questionId)
const AIGradeOutputSchema = GradeAssessmentAnswerOutputSchema.omit({ questionId: true });

const gradeAnswerPrompt = ai.definePrompt({
  name: 'gradeAnswerPrompt',
  input: { schema: GradeAssessmentAnswerInputSchema },
  output: { schema: AIGradeOutputSchema },
  // model: 'googleai/gemini-1.5-flash', // Example: Specify model if needed
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
- If problems are found, flag them using ONLY flags from: [${Object.values(AnswerFlagsSchema.enum).join(', ')}].
- Suggest the difficulty for the NEXT question:
  - "easier" (if score < 40)
  - "same" (if score 40–85)
  - "harder" (if score > 85)

STRICT OUTPUT: Return ONLY a JSON object matching this schema exactly:
{
  "score": Integer (0-100),
  "feedback": String (concise and specific),
  "flags": [Optional: flags from [${Object.values(AnswerFlagsSchema.enum).join(', ')}]],
  "suggestedNextDifficulty": "easier" | "same" | "harder"
}

IMPORTANT: Do NOT include any explanatory text or extra formatting. Only output the JSON object. Ensure score is between 0 and 100.`,
});


// --- Define the Flow ---
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
    console.log(`Grading answer for question ${input.questionId} (Skill: ${input.skillTested}, Difficulty: ${input.difficulty})...`);

    try {
      // Call the defined prompt
      const { output: aiOutput } = await gradeAnswerPrompt(input);

      if (!aiOutput) {
        throw new Error(`AI did not return valid JSON grading output.`);
      }

      // Validate AI output structure (already done by prompt definition)
      // Additional validation/clamping if needed
      if (aiOutput.score < 0 || aiOutput.score > 100) {
           console.warn(`AI returned score (${aiOutput.score}) outside 0-100 range. Clamping.`);
           aiOutput.score = Math.max(0, Math.min(100, aiOutput.score));
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
      // Catch errors from AI call or parsing/validation
      console.error(`Grading error for question ${input.questionId}:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Propagate the error to the caller
      throw new Error(`Failed to grade answer for question ${input.questionId}: ${errorMessage}`);
    }
  }
);


// --- Main Exported Function (Wrapper) ---
export async function gradeAssessmentAnswer(input: GradeAssessmentAnswerInput): Promise<GradeAssessmentAnswerOutput> {
  // Input validation handled by the flow
  GradeAssessmentAnswerInputSchema.parse(input);
  return gradeAssessmentAnswerFlow(input);
}
