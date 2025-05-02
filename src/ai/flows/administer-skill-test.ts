'use server';
/**
 * @fileOverview Generates skill test questions for freelancers based on their selected skills.
 *
 * Exports:
 * - administerSkillTest - Generates and returns test questions.
 * - AdministerSkillTestInput - Input type.
 * - AdministerSkillTestOutput - Output type.
 * - Question - Individual question type.
 */
import { callAI } from '@/ai/ai-instance'; // Import the centralized callAI function
import {
  AdministerSkillTestInputSchema,
  type AdministerSkillTestInput,
  AdministerSkillTestOutputSchema,
  type AdministerSkillTestOutput,
  QuestionSchema,
  type Question,
} from '@/ai/schemas/administer-skill-test-schema';
import { z } from 'zod';

// Only export the async function and related types
export type { AdministerSkillTestInput, AdministerSkillTestOutput, Question };

// --- Main function ---
export async function administerSkillTest(input: AdministerSkillTestInput): Promise<AdministerSkillTestOutput> {
  // Validation is implicitly handled by Zod schema in the Genkit framework if used there,
  // or needs to be explicitly called if this function is used directly.
  AdministerSkillTestInputSchema.parse(input);

  const testId = `test_${input.freelancerId}_${Date.now()}`;
  const questions: Question[] = [];

  console.log(`Generating skill test for Freelancer ${input.freelancerId} with skills: ${input.skills.join(', ')}`);

  // Loop through each skill and generate a question
  for (const skill of input.skills) {
    try {
      console.log(`Generating question for skill: ${skill}...`);

      // Construct the prompt for the callAI function
      const promptText = `You are an AI hiring assistant specializing in creating skill assessment questions.
Generate exactly ONE practical and relevant test question for a freelancer (ID: ${input.freelancerId}) claiming the following skill: ${skill}.
The question should effectively probe their proficiency in this specific skill.

Focus on realistic scenarios:
- For visual skills (e.g., Graphic Design), ask to describe design processes or critique examples.
- For technical skills (e.g., React Development), ask conceptual or code analysis questions.
- For writing skills (e.g., Copywriting), ask to write or critique a short text.

Return ONLY a JSON object with:
{
  "questionText": "The test question."
}
Do NOT add any extra explanations outside the JSON object.`;

      // Call the centralized AI function (which handles model selection and validation)
      const responseText = await callAI(promptText);

      // Attempt to parse the JSON response
      let parsedOutput: { questionText: string };
      try {
        // Basic JSON extraction (might need refinement based on AI behavior)
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON object found in response.");
        parsedOutput = JSON.parse(jsonMatch[0]);

        // Validate the parsed output structure
        const validationResult = z.object({ questionText: z.string().min(1) }).safeParse(parsedOutput);
        if (!validationResult.success) {
          throw new Error(`Invalid JSON structure: ${validationResult.error.errors.map(e => e.message).join(', ')}`);
        }
        parsedOutput = validationResult.data; // Use validated data

      } catch (parseError: any) {
        console.error(`Error parsing question JSON for skill "${skill}":`, parseError.message, "Raw Response:", responseText);
        throw new Error(`AI did not return valid JSON question text for skill "${skill}".`);
      }


      // Manually construct the full Question object
      const validatedQuestion: Question = {
        questionText: parsedOutput.questionText,
        skillTested: skill, // Ensure the skillTested field is correctly set
      };

      questions.push(validatedQuestion);
      console.log(`Successfully generated question for skill: ${skill}`);

    } catch (error: any) {
      console.error(`Error generating or processing question for skill "${skill}":`, error?.message || error);
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
    // This might happen if JSON parsing failed for some skills
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
    
