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

// Export types
export type { GenerateAssessmentQuestionInput, GenerateAssessmentQuestionOutput, DifficultyLevel };

// Main exported function
export async function generateAssessmentQuestion(input: GenerateAssessmentQuestionInput): Promise<GenerateAssessmentQuestionOutput> {
  const timestamp = Date.now();

  // Move selectedModel OUTSIDE of try-catch so it’s always defined
  const selectedModel = chooseModelBasedOnPrompt(input.primarySkill);

  try {
    console.log(`Generating assessment question for skill "${input.primarySkill}" (Difficulty: ${input.difficulty}) using model: ${selectedModel}`);

    const uniqueQuestionId = `q_${input.freelancerId}_${timestamp}`;

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

    const responseString = await callAI(selectedModel, promptText);

    try {
      const cleanedResponse = responseString.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      const parsed = JSON.parse(cleanedResponse);
      const output = GenerateAssessmentQuestionOutputSchema.parse(parsed);

      if (!output?.questionText || !output?.questionId) {
        console.error(`Invalid AI output from ${selectedModel}:`, output, "Raw:", responseString);
        throw new Error(`Invalid question generated for skill ${input.primarySkill}.`);
      }

      // Force correct fields
      output.questionId = uniqueQuestionId;
      output.skillTested = input.primarySkill;
      output.difficulty = input.difficulty;

      console.log(`Generated question ${output.questionId} for ${input.primarySkill} at ${input.difficulty} using ${selectedModel}`);
      return output;

    } catch (parseError: any) {
      console.error(`Failed parsing AI response from ${selectedModel}:`, parseError?.errors ?? parseError, "Raw:", responseString);
      throw new Error(`Invalid JSON structure returned when generating question.`);
    }

  } catch (error: any) {
    console.error(`Failed to generate assessment question for ${input.primarySkill} using ${selectedModel}:`, error);
    throw new Error(`Generation error for ${input.primarySkill} (${selectedModel}): ${error instanceof Error ? error.message : String(error)}`);
  }
}
