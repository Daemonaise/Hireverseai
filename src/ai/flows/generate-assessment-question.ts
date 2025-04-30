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

import { callAI } from '@/ai/ai-instance';
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
  // GenerateAssessmentQuestionInputSchema.parse(input);

  const timestamp = Date.now();

  // Determine model based on primary skill (uses centralized logic)
  const selectedModel = chooseModelBasedOnPrompt(input.primarySkill);

  try {
    console.log(`Generating assessment question for skill "${input.primarySkill}" (Difficulty: ${input.difficulty}) using model: ${selectedModel}`);

    const uniqueQuestionId = `q_${input.freelancerId}_${timestamp}`;

    // Describe the expected JSON output format for the AI
    const schemaDescription = `{
  "questionId": "Unique ID like '${uniqueQuestionId}'",
  "questionText": "The generated question text.",
  "skillTested": "${input.primarySkill}",
  "difficulty": "${input.difficulty}"
}`;

    const previousQuestionsList = input.previousQuestions?.length
      ? `Avoid generating questions similar to:\n${input.previousQuestions.map(q => `- ${q}`).join('\n')}`
      : '';

    const allSkillsList = input.allSkills.map(skill => `- ${skill}`).join('\n');

    // Construct the prompt for the AI
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
Enforce 'questionId', 'skillTested', and 'difficulty' to match exactly. No extra text outside the JSON.`;

    // Use the centralized callAI function
    const responseString = await callAI('auto', promptText); // Let model selector choose

    try {
      const cleanedResponse = responseString.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      const parsed = JSON.parse(cleanedResponse);

      // Validate the parsed JSON against the output schema
      const output = GenerateAssessmentQuestionOutputSchema.parse(parsed);

      // Additional defensive check (schema should catch this)
      if (!output?.questionText || !output?.questionId) {
        console.error(`Invalid AI output structure from ${selectedModel}:`, output, "Raw:", responseString);
        throw new Error(`Invalid question generated for skill ${input.primarySkill}.`);
      }

      // Force correct fields based on input, overriding potentially incorrect AI output
      output.questionId = uniqueQuestionId;
      output.skillTested = input.primarySkill;
      output.difficulty = input.difficulty;

      console.log(`Generated question ${output.questionId} for ${input.primarySkill} at ${input.difficulty} using ${selectedModel}`);
      return output;

    } catch (parseError: any) {
      console.error(`Failed parsing/validating AI response from ${selectedModel}:`, parseError?.errors ?? parseError, "Raw:", responseString);
      // Throw a new error that will be caught by the outer catch block
      throw new Error(`Invalid JSON structure returned by AI when generating question.`);
    }

  } catch (error: any) {
    // Catch errors from callAI or from the inner try-catch block
    console.error(`Failed to generate assessment question for ${input.primarySkill} using ${selectedModel}:`, error);
    // Propagate the error to the caller
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Generation error for ${input.primarySkill} (${selectedModel}): ${errorMessage}`);
  }
}
