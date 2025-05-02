'use server';
/**
 * @fileOverview Generates skill test questions for freelancers based on their selected skills.
 *
 * Exports:
 * - administerSkillTest - Generates and returns test questions.
 */
import { ai, chooseModelBasedOnPrompt } from '@/ai/ai-instance'; // Import the configured ai instance and helpers
import { z } from 'zod';
import {
  AdministerSkillTestInputSchema,
  type AdministerSkillTestInput,
  AdministerSkillTestOutputSchema,
  type AdministerSkillTestOutput,
  QuestionSchema,
  type Question,
} from '@/ai/schemas/administer-skill-test-schema';
import { SingleSkillScoreAIOutputSchema } from '@/ai/schemas/score-skill-test-schema';

// Export types separately
export type { AdministerSkillTestInput, AdministerSkillTestOutput, Question };

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


// --- Define the Prompt Template (without model) ---
const SingleQuestionInputSchema = z.object({
  skill: z.string(),
  freelancerId: z.string(),
});
const SingleQuestionOutputSchema = z.object({
  questionText: z.string().min(10), // Expecting just the question text from AI
});

const skillQuestionPromptTemplate = `You are an AI hiring assistant specializing in creating skill assessment questions.
Generate exactly ONE practical and relevant test question for a freelancer (ID: {{{freelancerId}}}) claiming the following skill: {{{skill}}}.
The question should effectively probe their proficiency in this specific skill.

Focus on realistic scenarios:
- For visual skills (e.g., Graphic Design), ask to describe design processes or critique examples.
- For technical skills (e.g., React Development), ask conceptual or code analysis questions.
- For writing skills (e.g., Copywriting), ask to write or critique a short text.

Return ONLY a JSON object with:
{
  "questionText": "The test question."
}
Do NOT add any extra explanations outside the JSON object. Ensure 'questionText' is at least 10 characters long.`;


// --- Define the Flow ---
const administerSkillTestFlow = ai.defineFlow<
  typeof AdministerSkillTestInputSchema,
  typeof AdministerSkillTestOutputSchema
>(
  {
    name: 'administerSkillTestFlow',
    inputSchema: AdministerSkillTestInputSchema,
    outputSchema: AdministerSkillTestOutputSchema,
  },
  async (input) => {
    const testId = `test_${input.freelancerId}_${Date.now()}`;
    const questions: Question[] = [];

    console.log(`Generating skill test for Freelancer ${input.freelancerId} with skills: ${input.skills.join(', ')}`);

    // Loop through each skill and generate a question
    for (const skill of input.skills) {
      try {
        console.log(`Generating question for skill: ${skill}...`);

        // 1. Choose the primary model for generation
        const primaryModel = await chooseModelBasedOnPrompt(`Generate skill test question for: ${skill}`);
        console.log(`Using model ${primaryModel} for generation.`);

        // 2. Define the prompt using the chosen model and template
        const skillQuestionPrompt = ai.definePrompt({
          name: `skillQuestionPrompt_${skill}_${primaryModel.replace(/[^a-zA-Z0-9]/g, '_')}`, // Dynamic name
          input: { schema: SingleQuestionInputSchema },
          output: { schema: SingleQuestionOutputSchema },
          prompt: skillQuestionPromptTemplate,
          model: primaryModel, // Set the chosen model
        });

        // 3. Generate the initial question
        const promptInput = { skill, freelancerId: input.freelancerId };
        const { output: aiOutput } = await skillQuestionPrompt(promptInput);

        if (!aiOutput?.questionText) {
            throw new Error(`AI (${primaryModel}) did not return valid question text for skill "${skill}".`);
        }

        // 4. Validate the output with other models
         const originalPromptText = skillQuestionPromptTemplate
              .replace('{{{skill}}}', skill)
              .replace('{{{freelancerId}}}', input.freelancerId);

          const validation = await validateAIOutput(originalPromptText, JSON.stringify(aiOutput), primaryModel);

          if (!validation.allValid) {
              console.warn(`Validation failed for question generation (skill: ${skill}). Reasoning:`, validation.results);
              // Optionally, retry or use fallback
              throw new Error(`Question generation for skill "${skill}" failed cross-validation.`);
          }


        // 5. Construct and add the validated question
        const validatedQuestion: Question = {
          questionText: aiOutput.questionText,
          skillTested: skill, // Ensure the skillTested field is correctly set
        };

        questions.push(validatedQuestion);
        console.log(`Successfully generated and validated question for skill: ${skill}`);

      } catch (error: any) {
        console.error(`Error generating or validating question for skill "${skill}":`, error?.message || error);
        // Fallback: Insert placeholder question
        questions.push({
          questionText: `Placeholder question for ${skill}: Describe your experience with ${skill}.`,
          skillTested: skill,
        });
      }
    }

    // Validate overall result
    if (questions.length !== input.skills.length) {
      console.warn(`Mismatch: Expected ${input.skills.length} questions but got ${questions.length}.`);
      // This might happen if errors occurred for some skills
    }

    if (questions.length === 0) {
      console.error("No questions generated. Returning empty test.");
      return {
        testId,
        instructions: 'Error: Could not generate test questions. Please try again later.',
        questions: [],
      };
    }

    // Construct the final output adhering to the schema
    const output: AdministerSkillTestOutput = {
      testId,
      instructions: 'Please answer the following questions carefully to demonstrate your skills.',
      questions,
    };

    // Validate the final output before returning (optional but good practice)
    AdministerSkillTestOutputSchema.parse(output);

    return output;
  }
);


// --- Main Exported Function (Wrapper) ---
export async function administerSkillTest(input: AdministerSkillTestInput): Promise<AdministerSkillTestOutput> {
  // Validation is implicitly handled by Zod schema in the Flow definition,
  // but can be done here too for immediate feedback if called directly.
  AdministerSkillTestInputSchema.parse(input);
  return administerSkillTestFlow(input);
}
