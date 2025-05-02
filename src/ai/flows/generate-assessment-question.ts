'use server';
/**
 * @fileOverview Generates a single adaptive assessment question.
 * Uses dynamic model selection via callAI.
 *
 * Exports:
 * - generateAssessmentQuestion - A function that generates one question.
 * - GenerateAssessmentQuestionInput - Input type.
 * - GenerateAssessmentQuestionOutput - Output type.
 * - DifficultyLevel - Difficulty level type.
 */

import { callAI } from '@/ai/ai-instance'; // Import the centralized callAI function
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
  // Validate input
  GenerateAssessmentQuestionInputSchema.parse(input);

  const timestamp = Date.now();
  const uniqueQuestionId = `q_${input.freelancerId}_${timestamp}`;

  console.log(`Generating assessment question for skill "${input.primarySkill}" (Difficulty: ${input.difficulty})...`);

  // Describe the expected JSON output format for the AI
  const schemaDescription = `{
"questionText": "The generated question text (string, min 10 chars)."
}`;

  const previousQuestionsList = input.previousQuestions?.length
    ? `Avoid generating questions similar to:\n${input.previousQuestions.map(q => `- ${q}`).join('\n')}`
    : '';

  const allSkillsList = input.allSkills.map(skill => `- ${skill}`).join('\n');

  // Construct the prompt for the callAI function
  const promptText = `You are an AI expert creating adaptive assessment questions for freelancers.
Generate exactly ONE practical and relevant question for a freelancer (ID: ${input.freelancerId}) based on their primary skill: ${input.primarySkill}.
Their other claimed skills are:
${allSkillsList}

The target difficulty level is: ${input.difficulty}.

${previousQuestionsList}

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
No extra text outside the JSON. Ensure 'questionText' is at least 10 characters long.`;

  try {
    // Call the centralized AI function
    const responseText = await callAI(promptText);

    // Attempt to parse the JSON response
    let aiOutput: { questionText: string };
    try {
      // Basic JSON extraction
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON object found in response.");
      const rawOutput = JSON.parse(jsonMatch[0]);

      // Validate the parsed output structure
      const validationResult = z.object({ questionText: z.string().min(10) }).safeParse(rawOutput);
      if (!validationResult.success) {
          throw new Error(`Invalid JSON structure: ${validationResult.error.errors.map(e => e.message).join(', ')}`);
      }
      aiOutput = validationResult.data; // Use validated data

    } catch (parseError: any) {
      console.error(`Error parsing question generation JSON:`, parseError.message, "Raw Response:", responseText);
      throw new Error(`AI did not return valid JSON question text.`);
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

    console.log(`Generated question ${finalOutput.questionId} for ${input.primarySkill} at ${input.difficulty}`);
    return finalOutput;

  } catch (error: any) {
    // Catch errors from callAI or parsing/validation
    console.error(`Failed to generate assessment question for ${input.primarySkill}:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Generation error for ${input.primarySkill}: ${errorMessage}`);
  }
}
    
