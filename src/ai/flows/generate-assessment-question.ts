'use server';
/**
 * @fileOverview Generates a single adaptive assessment question.
 *
 * Exports:
 * - generateAssessmentQuestion - A function that generates one question.
 */

import { ai, validateAIOutput, chooseModelBasedOnPrompt } from '@/ai/ai-instance'; // Import the configured ai instance and helpers
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
