
'use server';
/**
 * @fileOverview Generates skill test questions for freelancers based on their selected skills.
 * Uses dynamic model selection based on the skill.
 *
 * Exports:
 * - administerSkillTest - A function that generates test questions.
 * - AdministerSkillTestInput - Input type.
 * - AdministerSkillTestOutput - Output type.
 * - Question - Question structure type.
 */

// Correctly import from the ai-instance module
import { chooseModelBasedOnPrompt, callAI } from '@/ai/ai-instance';
import { z } from 'zod'; // Use standard zod import
import {
  AdministerSkillTestInputSchema,
  type AdministerSkillTestInput,
  AdministerSkillTestOutputSchema,
  type AdministerSkillTestOutput,
  QuestionSchema,
  type Question,
} from '@/ai/schemas/administer-skill-test-schema';

// Export types
export type { AdministerSkillTestInput, AdministerSkillTestOutput, Question };

// Main exported function
export async function administerSkillTest(input: AdministerSkillTestInput): Promise<AdministerSkillTestOutput> {
  const testId = `test_${input.freelancerId}_${Date.now()}`;
  const questions: Question[] = [];
  const generationPromises: Promise<void>[] = [];

  console.log(`Generating test for Freelancer ${input.freelancerId} with skills: ${input.skills.join(', ')} using dynamic model selection.`);

  for (const skill of input.skills) {
    const generateQuestionForSkill = async () => {
      try {
        // 1. Choose the model
        // Correctly use the imported function
        const selectedModel = chooseModelBasedOnPrompt(skill); // Use the existing function for model selection
        console.log(`Generating question for skill: ${skill} using model: ${selectedModel}`);

        // 2. Construct the prompt
        const promptText = `You are an expert AI hiring assistant specializing in creating skill assessment questions.
Generate exactly ONE practical and relevant test question for a freelancer (ID: ${input.freelancerId}) claiming to have the following skill: ${skill}.
The question should effectively probe their proficiency in this specific skill.

Focus on scenarios, problem-solving, or conceptual understanding relevant to the skill.
For visual skills like 'Graphic Design' or 'UI/UX Design', ask them to describe a process, critique a hypothetical design, or explain how they would approach a specific visual task. Avoid asking for file uploads.
For technical skills like 'Web Development (React)', provide a small code snippet to analyze or ask about a specific concept.
For writing skills like 'Copywriting', ask them to write a short piece or critique a sample text.

Output format MUST be ONLY a JSON object matching this structure:
{
  "questionText": "The text of the test question.",
  "skillTested": "${skill}"
}
Do not include any other text or explanations outside the JSON object.`;

        // 3. Call the AI using the unified function
        const responseString = await callAI(selectedModel, promptText); // Pass chosen model and prompt

        // 4. Parse and validate the response
        let question: Question;
        try {
          // Clean potential markdown code block fences
          const cleanedResponse = responseString.replace(/^```json\n?/, '').replace(/\n?```$/, '');
          const parsed = JSON.parse(cleanedResponse);
          question = QuestionSchema.parse(parsed); // Validate against Zod schema
          question.skillTested = skill; // Ensure correct skill is set
          console.log(`Successfully generated and parsed question for skill: ${skill} using ${selectedModel}`);
          questions.push(question);
        } catch (parseError: any) {
          console.error(`Error parsing/validating AI response for skill ${skill} using ${selectedModel}:`, parseError.errors ?? parseError, "Raw Response:", responseString);
          // Fallback question
          questions.push({ questionText: `Placeholder question for ${skill} - generation/parse failed. Describe your experience with ${skill}.`, skillTested: skill });
        }
      } catch (error: any) {
        console.error(`Error generating question for skill "${skill}":`, error);
        // Handle general API call errors
        questions.push({ questionText: `Placeholder question for skill ${skill} - error during generation. Describe your experience with ${skill}.`, skillTested: skill });
      }
    };
    generationPromises.push(generateQuestionForSkill());
  }

  await Promise.all(generationPromises);

  if (questions.length !== input.skills.length) {
    console.warn(`Expected ${input.skills.length} questions, but generated ${questions.length}. Some generations might have failed.`);
  }

  if (questions.length === 0 && input.skills.length > 0) {
    console.error("Failed to generate any skill test questions for skills:", input.skills.join(', '));
    return {
      testId: testId,
      instructions: 'Error: Could not generate test questions at this time.',
      questions: [],
    };
  }

  const finalOutput: AdministerSkillTestOutput = {
    testId: testId,
    instructions: 'Please answer the following questions to the best of your ability, demonstrating your skills.',
    questions: questions,
  };

  return finalOutput;
}
