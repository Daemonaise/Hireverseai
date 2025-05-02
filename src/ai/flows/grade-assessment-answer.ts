'use server';

/**
 * @fileOverview Grades a single answer from an adaptive assessment.
 */

import { ai, chooseModelBasedOnPrompt } from '@/ai/ai-instance'; // Import the configured ai instance and helpers
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

// --- Cross-Validation Logic (Included within the flow file) ---
const ValidationSchema = z.object({
  isValid: z.boolean().describe("Whether the original output is valid and accurate based on the original request."),
  reasoning: z.string().optional().describe("Explanation if invalid, or brief confirmation if valid."),
});
type ValidationResult = z.infer<typeof ValidationSchema>;

async function validateAIOutput(
  originalPrompt: string,
  originalOutput: string,
  primaryModelName: string
): Promise<{ allValid: boolean; results: ValidationResult[] }> {
  const validatorModels: string[] = [];
  const availableModels = {
    google: 'googleai/gemini-1.5-flash',
    openai: ['openai/gpt-4o-mini', 'openai/gpt-4o'],
    anthropic: ['anthropic/claude-3-haiku-20240307', 'anthropic/claude-3-5-sonnet-20240620']
  };

  // Re-read env vars inside this function to ensure up-to-date checks
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  if (GOOGLE_API_KEY && primaryModelName !== availableModels.google) validatorModels.push(availableModels.google);
  // Prefer cheaper models for validation if available
  if (OPENAI_API_KEY && !primaryModelName.startsWith('openai/')) validatorModels.push(availableModels.openai[0]);
  if (ANTHROPIC_API_KEY && !primaryModelName.startsWith('anthropic/')) validatorModels.push(availableModels.anthropic[0]);

  if (validatorModels.length === 0) {
    console.warn("[AI Validation] No other models available for cross-validation. Skipping.");
    return { allValid: true, results: [] }; // Assume valid if no validators
  }

  console.log(`[AI Validation] Validating output from ${primaryModelName} using models: ${validatorModels.join(', ')}`);

  const validationPrompt = `You are an AI evaluator. Assess if the following AI output accurately and completely fulfills the original request.
Return ONLY a JSON object with keys "isValid" (boolean) and "reasoning" (string, explanation if invalid, brief confirmation if valid).

=== Original Request ===
${originalPrompt}

=== AI Output to Validate ===
${originalOutput}

=== Evaluation ===
Does the output strictly follow the requested format (if any) and address all parts of the original request accurately?
Is the output sensible and relevant to the request?
Respond ONLY with the JSON object: {"isValid": boolean, "reasoning": string}`;

  const validationResults: ValidationResult[] = [];
  let allValid = true;

  for (const modelName of validatorModels) {
    try {
      const validationAI = ai.defineModel({
          name: `validationModel_${modelName.replace(/[^a-zA-Z0-9]/g, '_')}`,
          model: modelName,
          output: { schema: ValidationSchema }, // Ensure the model tries to output in the correct format
      });

      const { output } = await validationAI.generate({
        prompt: validationPrompt,
        output: { schema: ValidationSchema } // Reiterate schema for clarity
      });

      if (output) {
        const parsedOutput = ValidationSchema.parse(output); // Validate the structure
        validationResults.push(parsedOutput);
        if (!parsedOutput.isValid) {
          allValid = false;
        }
         console.log(`[AI Validation] Validator ${modelName} result: isValid=${parsedOutput.isValid}`);
      } else {
        console.warn(`[AI Validation] Validator ${modelName} returned empty or invalid output.`);
        validationResults.push({ isValid: false, reasoning: `Validator ${modelName} failed to provide valid JSON.` });
        allValid = false; // Treat empty output as failure
      }
    } catch (error: any) {
      console.error(`[AI Validation] Error validating with ${modelName}:`, error.message);
      validationResults.push({ isValid: false, reasoning: `Error during validation with ${modelName}: ${error.message}` });
      allValid = false; // Treat error as failure
    }
  }

  console.log(`[AI Validation] Final validation result: allValid=${allValid}`);
  return { allValid, results: validationResults };
}
// --- End Cross-Validation Logic ---

// --- Define the Prompt Template ---
// Schema for AI's direct output (excluding questionId)
const AIGradeOutputSchema = GradeAssessmentAnswerOutputSchema.omit({ questionId: true });

const gradeAnswerPromptTemplate = `You are an expert AI evaluator grading a freelancer's skill test answer.

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

IMPORTANT: Do NOT include any explanatory text or extra formatting. Only output the JSON object. Ensure score is between 0 and 100.`;


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
        // 1. Choose the primary model for generation
        const promptContext = `Grade answer for question about ${input.skillTested} (${input.difficulty}). Question: ${input.questionText}. Answer: ${input.answerText}`;
        const primaryModel = await chooseModelBasedOnPrompt(promptContext);
        console.log(`Using model ${primaryModel} for grading.`);

        // 2. Define the prompt using the chosen model and template
        const gradeAnswerPrompt = ai.definePrompt({
            name: `gradeAnswerPrompt_${input.questionId}_${primaryModel.replace(/[^a-zA-Z0-9]/g, '_')}`, // Dynamic name
            input: { schema: GradeAssessmentAnswerInputSchema },
            output: { schema: AIGradeOutputSchema },
            prompt: gradeAnswerPromptTemplate,
            model: primaryModel,
        });

      // 3. Call the defined prompt
      const { output: aiOutput } = await gradeAnswerPrompt(input);

      if (!aiOutput) {
        throw new Error(`AI (${primaryModel}) did not return valid JSON grading output.`);
      }

      // 4. Validate AI output structure (already done by prompt definition)
      // Additional validation/clamping if needed
      if (aiOutput.score < 0 || aiOutput.score > 100) {
           console.warn(`AI returned score (${aiOutput.score}) outside 0-100 range. Clamping.`);
           aiOutput.score = Math.max(0, Math.min(100, aiOutput.score));
       }

       // 5. Validate the output with other models
        const originalPromptText = gradeAnswerPromptTemplate
            .replace('{{{freelancerId}}}', input.freelancerId)
            .replace('{{{primarySkill}}}', input.primarySkill)
            .replace('{{{questionId}}}', input.questionId)
            .replace('{{{skillTested}}}', input.skillTested)
            .replace('{{{difficulty}}}', input.difficulty)
            .replace('{{{questionText}}}', input.questionText)
            .replace('{{{answerText}}}', input.answerText);

       const validation = await validateAIOutput(originalPromptText, JSON.stringify(aiOutput), primaryModel);

       if (!validation.allValid) {
           console.warn(`Validation failed for grading question ${input.questionId}. Reasoning:`, validation.results);
           // Optionally, retry or use fallback
           throw new Error(`Grading for question ${input.questionId} failed cross-validation.`);
       }


      // 6. Construct the full output object, adding the questionId back
      const finalOutput: GradeAssessmentAnswerOutput = {
        ...aiOutput,
        questionId: input.questionId,
      };

      // Validate the final constructed output (optional but recommended)
      GradeAssessmentAnswerOutputSchema.parse(finalOutput);

      console.log(`Successfully graded and validated question ${finalOutput.questionId}. Score: ${finalOutput.score}`);
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
