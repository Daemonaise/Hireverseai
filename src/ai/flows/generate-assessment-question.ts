'use server';
/**
 * @fileOverview Generates a single adaptive assessment question.
 *
 * Exports:
 * - generateAssessmentQuestion - A function that generates one question (async function).
 */

import { ai } from '@/lib/ai'; // Import the configured ai instance
import { chooseModelBasedOnPrompt } from '@/lib/ai-server-helpers'; // Import from correct location
import { z } from 'zod';
import {
  GenerateAssessmentQuestionInputSchema,
  type GenerateAssessmentQuestionInput,
  GenerateAssessmentQuestionOutputSchema,
  type GenerateAssessmentQuestionOutput,
} from '@/ai/schemas/generate-assessment-question-schema'; // Import types/schemas from separate file


// Define internal schema (not exported)
const AIQuestionOutputSchema = z.object({
  questionText: z.string().min(10, "Question text must be at least 10 characters."),
});

// Define prompt template (local constant)
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


// --- Define the Flow (local to this file, not exported) ---
const generateAssessmentQuestionFlow = ai.defineFlow(
  {
    name: 'generateAssessmentQuestionFlow',
    inputSchema: GenerateAssessmentQuestionInputSchema,
    outputSchema: GenerateAssessmentQuestionOutputSchema,
  },
  async (input) => {
    const timestamp = Date.now();
    const uniqueQuestionId = `q_${input.freelancerId}_${timestamp}`;


    try {
      // 1. Choose the primary model for generation
      const promptContext = `Generate ${input.difficulty} question for ${input.primarySkill}. Other skills: ${input.allSkills.join(', ')}. Avoid similar to: ${input.previousQuestions?.join('; ') ?? 'None'}`;
      const primaryModel = await chooseModelBasedOnPrompt(promptContext);

      // 2. Define the prompt using the chosen model and template
      const generateQuestionPrompt = ai.definePrompt({
        name: `generateQuestionPrompt_${input.primarySkill}_${input.difficulty}_${primaryModel.name.replace(/[^a-zA-Z0-9]/g, '_')}`,
        input: { schema: GenerateAssessmentQuestionInputSchema.extend({ timestamp: z.number() }) },
        output: { schema: AIQuestionOutputSchema },
        prompt: generateQuestionPromptTemplate,
        model: primaryModel,
      });

      // 3. Call the defined prompt
      const promptInput = { ...input, timestamp };
      const { output: aiOutput } = await generateQuestionPrompt(promptInput);

      if (!aiOutput?.questionText) {
        throw new Error(`AI (${primaryModel.name}) did not return valid JSON question text.`);
      }

      // 4. Validate the output with other models
            .replace('{{{freelancerId}}}', input.freelancerId)
            .replace('{{{primarySkill}}}', input.primarySkill)
            .replace(`{{#each allSkills}}- {{{this}}}
{{/each}}`, input.allSkills.map(s => `- ${s}`).join('\n'))
            .replace('{{{difficulty}}}', input.difficulty)
            .replace(`{{#if previousQuestions}}Avoid generating questions similar to:
{{#each previousQuestions}}- {{{this}}}
{{/each}}{{/if}}`,
                     input.previousQuestions && input.previousQuestions.length > 0
                         ? `Avoid generating questions similar to:\n${input.previousQuestions.map(q => `- ${q}`).join('\n')}`
                         : '');

       


      // 5. Construct the full output object
      const finalOutput: GenerateAssessmentQuestionOutput = {
        questionId: uniqueQuestionId,
        questionText: aiOutput.questionText,
        skillTested: input.primarySkill, // Use the input skill
        difficulty: input.difficulty, // Use the input difficulty
      };

      // Validate the final constructed output (optional but recommended)
      GenerateAssessmentQuestionOutputSchema.parse(finalOutput);

      return finalOutput;

    } catch (error: any) {
      // Catch errors from AI call or parsing/validation
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Generation error for ${input.primarySkill}: ${errorMessage}`);
    }
  }
);

// --- Main Exported Function (Wrapper - Async) ---
// This is the only export from this file.
export async function generateAssessmentQuestion(input: GenerateAssessmentQuestionInput): Promise<GenerateAssessmentQuestionOutput> {
  // Input validation handled by the flow
  GenerateAssessmentQuestionInputSchema.parse(input);
  return generateAssessmentQuestionFlow(input);
}
