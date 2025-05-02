'use server';
/**
 * @fileOverview Generates a single adaptive assessment question.
 *
 * Exports:
 * - generateAssessmentQuestion - A function that generates one question.
 */

import { ai, chooseModelBasedOnPrompt } from '@/ai/ai-instance'; // Import the configured ai instance and helpers
import { z } from 'zod';
import {
  GenerateAssessmentQuestionInputSchema,
  type GenerateAssessmentQuestionInput,
  GenerateAssessmentQuestionOutputSchema,
  type GenerateAssessmentQuestionOutput,
  DifficultyLevelSchema,
  type DifficultyLevel,
} from '@/ai/schemas/generate-assessment-question-schema';

// Export types separately
export type { GenerateAssessmentQuestionInput, GenerateAssessmentQuestionOutput, DifficultyLevel };

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
// Schema for the AI's direct output (just the question text)
const AIQuestionOutputSchema = z.object({
  questionText: z.string().min(10, "Question text must be at least 10 characters."),
});

const generateQuestionPromptTemplate = `You are an AI expert creating adaptive assessment questions for freelancers.
Generate exactly ONE practical and relevant question for a freelancer (ID: {{{freelancerId}}}) based on their primary skill: {{{primarySkill}}}.
Their other claimed skills are:
{{#each allSkills}}- {{{this}}}
{{/each}}

The target difficulty level is: {{{difficulty}}}.

{{#if previousQuestions}}Avoid generating questions similar to:
{{#each previousQuestions}}- {{{this}}}
{{/each}}{{/if}}

Instructions:
- Beginner: basic concepts, definitions, simple tasks.
- Intermediate: use cases, applying concepts, troubleshooting.
- Advanced: complex scenarios, optimizations, patterns.
- Expert: edge cases, architecture, strategic reasoning.

For visual skills (e.g., Graphic Design): ask about processes, critiques, approaches. No file uploads.
For technical skills (e.g., React, Python): include small code snippets or conceptual challenges.
For writing skills: request short writing samples, critiques, or strategy explanations.

Output ONLY a JSON object strictly like this:
{
"questionText": "The generated question text (string, min 10 chars)."
}
No extra text outside the JSON.`;


// --- Define the Flow ---
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
    const timestamp = Date.now();
    const uniqueQuestionId = `q_${input.freelancerId}_${timestamp}`;

    console.log(`Generating assessment question for skill "${input.primarySkill}" (Difficulty: ${input.difficulty})...`);

    try {
      // 1. Choose the primary model for generation
      const promptContext = `Generate ${input.difficulty} question for ${input.primarySkill}. Other skills: ${input.allSkills.join(', ')}. Avoid similar to: ${input.previousQuestions?.join('; ') ?? 'None'}`;
      const primaryModel = await chooseModelBasedOnPrompt(promptContext);
      console.log(`Using model ${primaryModel} for question generation.`);

      // 2. Define the prompt using the chosen model and template
      const generateQuestionPrompt = ai.definePrompt({
        name: `generateQuestionPrompt_${input.primarySkill}_${input.difficulty}_${primaryModel.replace(/[^a-zA-Z0-9]/g, '_')}`, // Dynamic name
        input: { schema: GenerateAssessmentQuestionInputSchema.extend({ timestamp: z.number() }) },
        output: { schema: AIQuestionOutputSchema },
        prompt: generateQuestionPromptTemplate,
        model: primaryModel,
      });

      // 3. Call the defined prompt
      const promptInput = { ...input, timestamp };
      const { output: aiOutput } = await generateQuestionPrompt(promptInput);

      if (!aiOutput?.questionText) {
        throw new Error(`AI (${primaryModel}) did not return valid JSON question text.`);
      }

      // 4. Validate the output with other models
       const originalPromptText = generateQuestionPromptTemplate
            .replace('{{{freelancerId}}}', input.freelancerId)
            .replace('{{{primarySkill}}}', input.primarySkill)
            .replace('{{#each allSkills}}- {{{this}}}\n{{/each}}', input.allSkills.map(s => `- ${s}`).join('\n'))
            .replace('{{{difficulty}}}', input.difficulty)
            .replace('{{#if previousQuestions}}Avoid generating questions similar to:\n{{#each previousQuestions}}- {{{this}}}\n{{/each}}{{/if}}',
                     input.previousQuestions && input.previousQuestions.length > 0
                         ? `Avoid generating questions similar to:\n${input.previousQuestions.map(q => `- ${q}`).join('\n')}`
                         : '');

       const validation = await validateAIOutput(originalPromptText, JSON.stringify(aiOutput), primaryModel);

       if (!validation.allValid) {
           console.warn(`Validation failed for question generation (Skill: ${input.primarySkill}, Difficulty: ${input.difficulty}). Reasoning:`, validation.results);
           // Optionally, retry or use fallback
           throw new Error(`Question generation for ${input.primarySkill} (${input.difficulty}) failed cross-validation.`);
       }


      // 5. Construct the full output object
      const finalOutput: GenerateAssessmentQuestionOutput = {
        questionId: uniqueQuestionId,
        questionText: aiOutput.questionText,
        skillTested: input.primarySkill, // Use the input skill
        difficulty: input.difficulty, // Use the input difficulty
      };

      // Validate the final constructed output (optional but recommended)
      GenerateAssessmentQuestionOutputSchema.parse(finalOutput);

      console.log(`Generated and validated question ${finalOutput.questionId} for ${input.primarySkill} at ${input.difficulty}`);
      return finalOutput;

    } catch (error: any) {
      // Catch errors from AI call or parsing/validation
      console.error(`Failed to generate assessment question for ${input.primarySkill}:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Generation error for ${input.primarySkill}: ${errorMessage}`);
    }
  }
);

// --- Main Exported Function (Wrapper) ---
export async function generateAssessmentQuestion(input: GenerateAssessmentQuestionInput): Promise<GenerateAssessmentQuestionOutput> {
  // Input validation handled by the flow
  GenerateAssessmentQuestionInputSchema.parse(input);
  return generateAssessmentQuestionFlow(input);
}
