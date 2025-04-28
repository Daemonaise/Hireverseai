
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

// Correctly import from the ai-instance module
import { chooseModelBasedOnPrompt, callAI } from '@/ai/ai-instance';
import { z } from 'zod'; // Use standard zod import
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
    const timestamp = Date.now(); // Generate timestamp here

    try {
        // 1. Choose model
        // Correctly use the imported function
        const selectedModel = chooseModelBasedOnPrompt(input.primarySkill);
        console.log(`Generating assessment question for skill "${input.primarySkill}" (Difficulty: ${input.difficulty}) using model: ${selectedModel}`);

        // 2. Construct prompt
        const uniqueQuestionId = `q_${input.freelancerId}_${timestamp}`;
        const schemaDescription = `{
  "questionId": "Unique ID like '${uniqueQuestionId}'",
  "questionText": "The generated question text.",
  "skillTested": "${input.primarySkill}",
  "difficulty": "${input.difficulty}"
}`;
        const previousQuestionsList = input.previousQuestions && input.previousQuestions.length > 0
            ? `Avoid generating questions similar to these previous ones:\n${input.previousQuestions.map(q => `- ${q}`).join('\n')}`
            : '';
        const allSkillsList = input.allSkills.map(s => `- ${s}`).join('\n');

        const promptText = `You are an AI expert creating adaptive assessment questions for freelancers.
Generate exactly ONE practical and relevant question for a freelancer (ID: ${input.freelancerId}) based on their primary skill: ${input.primarySkill}.
Consider their other claimed skills for context:
${allSkillsList}

The target difficulty level for this question is: ${input.difficulty}.

${previousQuestionsList}

The question should effectively probe their proficiency in the primary skill at the specified difficulty level.
- For 'beginner', focus on basic concepts, definitions, or simple tasks.
- For 'intermediate', focus on common use cases, applying concepts, or troubleshooting simple problems.
- For 'advanced', focus on complex scenarios, optimization, design patterns, or nuanced understanding.
- For 'expert', focus on edge cases, architectural decisions, strategic thinking, or deep theoretical knowledge.

For visual skills (e.g., Graphic Design, UI/UX), ask for descriptions of processes, critiques, or approaches to specific tasks. Avoid asking for file uploads.
For technical skills (e.g., React, Python), provide code snippets to analyze, ask about specific concepts, or pose problem-solving challenges.
For writing skills (e.g., Copywriting), ask for short writing samples, critiques, or explanations of strategy.

Output ONLY a JSON object strictly following this structure:
${schemaDescription}
Ensure 'questionId' is unique, 'skillTested' is exactly "${input.primarySkill}", and 'difficulty' is exactly "${input.difficulty}".
Do not include any explanations or introductory text outside the JSON object.`;

        // 3. Call AI using the unified function
        const responseString = await callAI(selectedModel, promptText);

        // 4. Parse and validate response
        try {
            // Clean potential markdown code block fences
            const cleanedResponse = responseString.replace(/^```json\n?/, '').replace(/\n?```$/, '');
            const parsed = JSON.parse(cleanedResponse);
            const output = GenerateAssessmentQuestionOutputSchema.parse(parsed);

            if (!output || !output.questionText || !output.questionId) {
                 console.error(`AI (${selectedModel}) failed to generate valid question output:`, output, "Raw:", responseString);
                 throw new Error(`Failed to generate a valid question using ${selectedModel} for skill ${input.primarySkill} at difficulty ${input.difficulty}.`);
            }

            // Ensure generated fields match input constraints
            output.questionId = uniqueQuestionId; // Override AI potentially making up ID
            output.skillTested = input.primarySkill;
            output.difficulty = input.difficulty;


            console.log(`Generated question ${output.questionId} for skill ${input.primarySkill} using ${selectedModel}`);
            return output;

        } catch (parseError: any) {
             console.error(`Error parsing/validating AI response for question generation using ${selectedModel}:`, parseError.errors ?? parseError, "Raw Response:", responseString);
             throw new Error(`AI (${selectedModel}) returned an invalid response structure.`);
        }

    } catch (error: any) {
         console.error(`Error generating assessment question for skill ${input.primarySkill} with ${selectedModel}:`, error);
         // Throw error to be caught by the caller (e.g., AdaptiveSkillAssessment component)
         const errorMessage = error instanceof Error ? error.message : String(error);
         throw new Error(`Error generating assessment question for skill ${input.primarySkill} with ${selectedModel}: ${errorMessage}`);
    }
}
