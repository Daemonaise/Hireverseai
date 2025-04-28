'use server';
/**
 * @fileOverview Scores a freelancer's submitted answers for a skill test.
 * Uses dynamic model selection based on the skill being scored.
 *
 * Exports:
 * - scoreSkillTest - A function that handles the scoring process and updates Firestore.
 */

import { ai, chooseModelBasedOnPrompt } from '@/ai/ai-instance'; // Import chooseModelBasedOnPrompt
import { z } from 'genkit';
import { updateFreelancerTestScore } from '@/services/firestore';
import {
    ScoreSkillTestInputSchema, // Import schema definition
    type ScoreSkillTestInput, // Export type only
    ScoreSkillTestOutputSchema, // Import schema definition
    type ScoreSkillTestOutput, // Export type only
    AnswerSchema, // Import schema definition
    type Answer, // Export type only
    SkillScoreSchema, // Import schema definition
    type SkillScore, // Export type only
} from '@/ai/schemas/score-skill-test-schema';

// Define the prompt structure generator function for skill scoring
// Keep internal, do not export
const createScoreSkillPrompt = (modelName: string) => ai.definePrompt({
    name: `scoreSkillPrompt_${modelName.replace(/[^a-zA-Z0-9]/g, '_')}`, // Dynamic name
    input: { schema: z.object({ skill: z.string(), answers: z.array(AnswerSchema) }) },
    output: { schema: SkillScoreSchema },
    model: modelName, // Use dynamically selected model
    prompt: `You are an expert AI evaluator assessing a freelancer's skill based on their test answers.
Skill being evaluated: {{{skill}}}

Evaluate the following answer(s) provided by the freelancer for questions testing this skill:
{{#each answers}}
---
Question: {{{this.questionText}}}
Answer: {{{this.answerText}}}
---
{{/each}}

Based *only* on the answer(s) above, assess the freelancer's proficiency in "{{{skill}}}". Consider accuracy, completeness, clarity, and relevance.
Assign a score from 0 to 100 for this skill.
Provide concise reasoning for the score, highlighting specific strengths or weaknesses observed in the answer(s). Be specific (e.g., "Correctly identified X but missed Y," "Provided a clear explanation of Z," "Answer was too brief and lacked detail").

Output MUST follow the SkillScore schema with 'skill', 'score', and 'reasoning'. Ensure the 'skill' field is exactly "{{{skill}}}".`,
    config: {
        temperature: 0.3,
    },
});

// Define the prompt structure generator function for aggregation
// This usually doesn't need complex model selection, but we'll follow the pattern
// Keep internal, do not export
const createAggregateScoresPrompt = (modelName: string) => ai.definePrompt({
  name: `aggregateScoresPrompt_${modelName.replace(/[^a-zA-Z0-9]/g, '_')}`,
  input: {
    schema: z.object({
        skillScores: z.array(SkillScoreSchema),
        freelancerId: z.string(),
        testId: z.string(),
    })
  },
  output: {
    schema: z.object({
        overallScore: z.number().int().min(0).max(100).describe("Average score rounded to the nearest integer."),
        feedback: z.string().optional().describe("Brief overall feedback (1-2 sentences)."),
    })
  },
  model: modelName, // Use dynamic model
  prompt: `You are summarizing the results of a freelancer skill test.
Freelancer ID: {{{freelancerId}}}
Test ID: {{{testId}}}

Individual Skill Scores:
{{#each skillScores}}
- Skill: {{{this.skill}}}
  Score: {{{this.score}}}/100
  Reasoning: {{{this.reasoning}}}
{{/each}}

Calculate the overall score as the average of the individual skill scores (rounded to the nearest integer).
Provide brief (1-2 sentences) overall feedback summarizing the freelancer's performance based on the scores and reasoning.

Output only the overallScore and optional feedback according to the schema.`,
});

// Export only the async wrapper function and types
export type { ScoreSkillTestInput, ScoreSkillTestOutput, Answer, SkillScore };

export async function scoreSkillTest(input: ScoreSkillTestInput): Promise<ScoreSkillTestOutput> {
  const result = await scoreSkillTestFlow(input);

  // Firestore update logic remains the same
  if (result && result.skillScores.length > 0) {
      try {
        const updatePromises = result.skillScores.map(skillScore =>
          updateFreelancerTestScore(input.freelancerId, skillScore.skill, skillScore.score)
        );
        await Promise.all(updatePromises);
        console.log(`Successfully updated all test scores in Firestore for freelancer ${input.freelancerId}`);
      } catch (error) {
        console.error(`Failed to update one or more scores in Firestore for freelancer ${input.freelancerId}:`, error);
      }
  } else {
      console.warn(`No skill scores generated for freelancer ${input.freelancerId}, test ${input.testId}. Skipping Firestore update.`);
  }

  return result;
}

// Keep internal, do not export
const scoreSkillTestFlow = ai.defineFlow<
  typeof ScoreSkillTestInputSchema,
  typeof ScoreSkillTestOutputSchema
>(
  {
    name: 'scoreSkillTestFlow',
    inputSchema: ScoreSkillTestInputSchema,
    outputSchema: ScoreSkillTestOutputSchema,
  },
  async (input) => {
    const skillScores: SkillScore[] = [];
    const scoringPromises: Promise<void>[] = [];

    console.log(`Scoring test ${input.testId} for Freelancer ${input.freelancerId}`);

    const answersBySkill = input.answers.reduce((acc, answer) => {
        const currentSkill = answer.skillTested;
        if (!acc[currentSkill]) {
            acc[currentSkill] = [];
        }
        acc[currentSkill].push(answer);
        return acc;
    }, {} as Record<string, Answer[]>);


    for (const skill in answersBySkill) {
        const skillAnswers = answersBySkill[skill];

        const scoreSkillAnswers = async () => {
            try {
                // Choose model based on the skill being scored - Await the async function
                const selectedModel = await chooseModelBasedOnPrompt(skill);
                console.log(`Scoring skill: ${skill} using model: ${selectedModel}`);

                // Create the specific prompt definition
                const scoreSkillPrompt = createScoreSkillPrompt(selectedModel);

                // Call the dynamically created prompt
                const { output: skillScore } = await scoreSkillPrompt(
                    { skill: skill, answers: skillAnswers }
                );

                if (skillScore && typeof skillScore.score === 'number' && skillScore.reasoning) {
                     skillScore.skill = skill; // Ensure correct skill
                    skillScores.push(skillScore);
                    console.log(`Successfully scored skill: ${skill} using ${selectedModel} - Score: ${skillScore.score}`);
                } else {
                    console.warn(`Failed to generate valid score for skill: ${skill} using ${selectedModel}. Output received:`, skillScore);
                    skillScores.push({ skill: skill, score: 0, reasoning: `Automated scoring failed for this skill using ${selectedModel}.` });
                }
            } catch (error: any) {
                 console.error(`Error scoring skill "${skill}":`, error);
                 if (error.message?.includes('API key')) {
                     console.error(`Ensure your GOOGLE_API_KEY (or other configured keys) is valid and has permissions.`);
                 } else if (error.message?.includes('INVALID_ARGUMENT')) {
                     console.error(`Invalid argument error scoring skill "${skill}". Check prompt/schema. Error:`, error.details);
                 }
                 skillScores.push({ skill: skill, score: 0, reasoning: "Error during automated scoring." });
            }
        };
        scoringPromises.push(scoreSkillAnswers());
    }

    await Promise.all(scoringPromises);

    if (skillScores.length === 0 && Object.keys(answersBySkill).length > 0) {
         console.error(`Scoring failed for all skills for test ${input.testId}`);
          return {
            overallScore: 0,
            skillScores: [],
            feedback: "Error: Could not score any skills.",
        };
    }
     if (skillScores.length === 0) {
        console.warn(`No answers found to score for test ${input.testId}`);
        return {
            overallScore: 0,
            skillScores: [],
            feedback: "No answers submitted for scoring.",
        };
    }

    const totalScore = skillScores.reduce((sum, ss) => sum + ss.score, 0);
    const overallScore = Math.round(totalScore / skillScores.length);

    // Generate overall feedback using a default model (or choose based on overall context)
    let feedback: string | undefined = "Overall performance summary based on scores.";
     if (skillScores.length > 0) {
         try {
             // Choose a model for aggregation - often simpler, so default is fine - Await the async function
             const aggregationModel = await chooseModelBasedOnPrompt("general feedback summary");
             console.log(`Generating overall feedback for test ${input.testId} using model ${aggregationModel}`);
             const aggregateScoresPrompt = createAggregateScoresPrompt(aggregationModel);

             const { output: aggregationResult } = await aggregateScoresPrompt({
                 skillScores: skillScores,
                 freelancerId: input.freelancerId,
                 testId: input.testId,
             });
             feedback = aggregationResult?.feedback ?? feedback;
             console.log(`Generated overall feedback for test ${input.testId} using ${aggregationModel}`);
         } catch (error: any) {
             console.error(`Error generating overall feedback for test ${input.testId}:`, error);
             if (error.message?.includes('API key')) {
                 console.error(`Ensure your GOOGLE_API_KEY (or other configured keys) is valid and has permissions.`);
             } else if (error.message?.includes('INVALID_ARGUMENT')) {
                 console.error(`Invalid argument error generating feedback for test ${input.testId}. Check prompt/schema. Error:`, error.details);
             }
             feedback = "Feedback generation failed.";
         }
     }

    const finalOutput: ScoreSkillTestOutput = {
        overallScore: overallScore,
        skillScores: skillScores,
        feedback: feedback,
    };

    return finalOutput;
  }
);
