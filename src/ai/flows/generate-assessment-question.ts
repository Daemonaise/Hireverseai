'use server';
/**
 * @fileOverview Generates a single adaptive assessment question.
 * Uses dynamic model selection based on the primary skill.
 *
 * Exports:
 * - generateAssessmentQuestion - A function that generates one question.
 * - GenerateAssessmentQuestionInput - Input type.
 * - GenerateAssessmentQuestionOutput - Output type.
 * - DifficultyLevel - Difficulty level type.
 */

import { ai } from '@/ai/ai-instance'; // Import ai instance
import { chooseModelBasedOnPrompt } from '@/lib/model-selector';
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

// Main exported function
export async function generateAssessmentQuestion(input: GenerateAssessmentQuestionInput): Promise<GenerateAssessmentQuestionOutput> {
  // Validate input (optional, often handled by caller/framework)
  GenerateAssessmentQuestionInputSchema.parse(input);

  const timestamp = Date.now();

  // Determine model based on primary skill (uses centralized logic)
  const selectedModel = chooseModelBasedOnPrompt(input.primarySkill);

  try {
    console.log(`Generating assessment question for skill "${input.primarySkill}" (Difficulty: ${input.difficulty}) using model: ${selectedModel}`);

    const uniqueQuestionId = `q_${input.freelancerId}_${timestamp}`;

    // Describe the expected JSON output format for the AI
    const schemaDescription = `{
  "questionText": "The generated question text."
}`; // AI should only return questionText

    const previousQuestionsList = input.previousQuestions?.length
      ? `Avoid generating questions similar to:\n${input.previousQuestions.map(q => `- ${q}`).join('\n')}`
      : '';

    const allSkillsList = input.allSkills.map(skill => `- ${skill}`).join('\n');

    // Define the Genkit prompt
    const generateQuestionPrompt = ai.definePrompt({
        name: `generateQuestion_${input.primarySkill}_${input.difficulty}`,
        input: { schema: GenerateAssessmentQuestionInputSchema },
        // AI only needs to output the question text
        output: { schema: z.object({ questionText: z.string() }) },
        model: selectedModel,
        prompt: `You are an AI expert creating adaptive assessment questions for freelancers.
Generate exactly ONE practical and relevant question for a freelancer (ID: {{{freelancerId}}}) based on their primary skill: {{{primarySkill}}}.
Their other claimed skills are:
{{{allSkills.map(skill => '- ' + skill).join('\\n')}}}

The target difficulty level is: {{{difficulty}}}.

{{{previousQuestionsList}}}

Instructions:
- Beginner: basic concepts, definitions, simple tasks.
- Intermediate: use cases, applying concepts, troubleshooting.
- Advanced: complex scenarios, optimizations, patterns.
- Expert: edge cases, architecture, strategic reasoning.

For visual skills (e.g., Graphic Design): ask about processes, critiques, approaches. No file uploads.
For technical skills (e.g., React, Python): include small code snippets or conceptual challenges.
For writing skills: request short writing samples, critiques, or strategy explanations.

Output ONLY a JSON object strictly like this:
${schemaDescription}
No extra text outside the JSON.`,
    });


    try {
       const { output: aiOutput } = await generateQuestionPrompt(input);

       if (!aiOutput || !aiOutput.questionText) {
           throw new Error(`AI (${selectedModel}) failed to return valid question text.`);
       }

      // Construct the full output object, manually setting the correct fields
      const finalOutput: GenerateAssessmentQuestionOutput = {
        questionId: uniqueQuestionId,
        questionText: aiOutput.questionText,
        skillTested: input.primarySkill,
        difficulty: input.difficulty,
      };

      // Validate the final constructed output (optional but recommended)
      GenerateAssessmentQuestionOutputSchema.parse(finalOutput);

      console.log(`Generated question ${finalOutput.questionId} for ${input.primarySkill} at ${input.difficulty} using ${selectedModel}`);
      return finalOutput;

    } catch (aiError: any) {
      console.error(`Failed generating/parsing AI response from ${selectedModel}:`, aiError?.errors ?? aiError, "Input:", input);
      // Throw a new error that will be caught by the outer catch block
      throw new Error(`Invalid response structure returned by AI when generating question.`);
    }

  } catch (error: any) {
    // Catch errors from prompt definition or execution
    console.error(`Failed to generate assessment question for ${input.primarySkill} using ${selectedModel}:`, error);
    // Propagate the error to the caller
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Generation error for ${input.primarySkill} (${selectedModel}): ${errorMessage}`);
  }
}
