'use server';
/**
 * @fileOverview Generates a single adaptive assessment question.
 *
 * Exports:
 * - generateAssessmentQuestion - A function that generates one question.
 * - GenerateAssessmentQuestionInput - Input type.
 * - GenerateAssessmentQuestionOutput - Output type.
 * - DifficultyLevel - Difficulty level type.
 */

import { ai } from '@/ai/ai-instance'; // Import the configured ai instance
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

// --- Define the Prompt ---
// Schema for the AI's direct output (just the question text)
const AIQuestionOutputSchema = z.object({
  questionText: z.string().min(10, "Question text must be at least 10 characters."),
});

const generateQuestionPrompt = ai.definePrompt({
  name: 'generateQuestionPrompt',
  // The prompt input needs all fields used in the handlebars template
  input: { schema: GenerateAssessmentQuestionInputSchema.extend({ timestamp: z.number() }) }, // Add timestamp if used for uniqueness in prompt
  output: { schema: AIQuestionOutputSchema },
  // model: 'googleai/gemini-1.5-flash', // Example: Specify model if needed
  prompt: `You are an AI expert creating adaptive assessment questions for freelancers.
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
No extra text outside the JSON.`,
});


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
      // Call the defined prompt
      const { output: aiOutput } = await generateQuestionPrompt({ ...input, timestamp }); // Pass timestamp if needed by prompt

      if (!aiOutput?.questionText) {
        throw new Error(`AI did not return valid JSON question text.`);
      }

      // Construct the full output object, manually setting the correct fields
      const finalOutput: GenerateAssessmentQuestionOutput = {
        questionId: uniqueQuestionId,
        questionText: aiOutput.questionText,
        skillTested: input.primarySkill, // Use the input skill
        difficulty: input.difficulty, // Use the input difficulty
      };

      // Validate the final constructed output (optional but recommended)
      GenerateAssessmentQuestionOutputSchema.parse(finalOutput);

      console.log(`Generated question ${finalOutput.questionId} for ${input.primarySkill} at ${input.difficulty}`);
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
