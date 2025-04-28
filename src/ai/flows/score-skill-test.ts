

/**
 * @fileOverview Scores a freelancer's submitted answers for a skill test.
 * Uses the default Google AI model.
 *
 * Exports:
 * - scoreSkillTest - A function that handles the scoring process and updates Firestore.
 */

import { ai } from '@/ai/ai-instance'; // Import the configured 'ai' instance
import { z } from 'genkit';
import { updateFreelancerTestScore } from '@/services/firestore'; // Import Firestore service
import {
    ScoreSkillTestInputSchema,
    type ScoreSkillTestInput, // Keep type import for internal use
    ScoreSkillTestOutputSchema,
    type ScoreSkillTestOutput, // Export output type
    AnswerSchema,
    type Answer,
    SkillScoreSchema,
    type SkillScore,
} from '@/ai/schemas/score-skill-test-schema'; // Import schemas/types

// Define the prompt structure outside the loop
const scoreSkillPromptDefinition = ai.definePrompt({
    name: `scoreSkillPrompt`, // Generic name
    input: { schema: z.object({ skill: z.string(), answers: z.array(AnswerSchema) }) },
    output: { schema: SkillScoreSchema }, // Expect a single SkillScore object
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
        temperature: 0.3, // Lower temperature for more objective scoring
    },
     // Model defaults to the one configured in ai-instance.ts
});

// This static prompt is used for aggregation only.
const aggregateScoresPrompt = ai.definePrompt({
  name: 'aggregateScoresPrompt',
  input: {
    schema: z.object({
        skillScores: z.array(SkillScoreSchema),
        freelancerId: z.string(),
        testId: z.string(),
    })
  },
  output: {
    schema: z.object({ // Only need overall score and feedback here
        overallScore: z.number().int().min(0).max(100).describe("Average score rounded to the nearest integer."),
        feedback: z.string().optional().describe("Brief overall feedback (1-2 sentences)."),
    })
  },
  // Model defaults to the one configured in ai-instance.ts
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

// 'use server'; - Not needed here, it's a standard async function
export async function scoreSkillTest(input: ScoreSkillTestInput): Promise<ScoreSkillTestOutput> {
  const result = await scoreSkillTestFlow(input);

  // After getting the scores from the AI, update Firestore
  if (result && result.skillScores.length > 0) {
      try {
        // Create promises for each Firestore update
        const updatePromises = result.skillScores.map(skillScore =>
          updateFreelancerTestScore(input.freelancerId, skillScore.skill, skillScore.score)
        );
        // Wait for all updates to complete
        await Promise.all(updatePromises);
        console.log(`Successfully updated all test scores in Firestore for freelancer ${input.freelancerId}`);
      } catch (error) {
        console.error(`Failed to update one or more scores in Firestore for freelancer ${input.freelancerId}:`, error);
        // Decide on error handling: re-throw, log, or return partial success?
        // For now, we'll let the flow result return but log the DB error.
      }
  } else {
      console.warn(`No skill scores generated for freelancer ${input.freelancerId}, test ${input.testId}. Skipping Firestore update.`);
  }

  return result;
}


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

    // Group answers by skill
    const answersBySkill = input.answers.reduce((acc, answer) => {
        const currentSkill = answer.skillTested; // Use the skill tested by the question
        if (!acc[currentSkill]) {
            acc[currentSkill] = [];
        }
        acc[currentSkill].push(answer);
        return acc;
    }, {} as Record<string, Answer[]>);


    for (const skill in answersBySkill) {
        const skillAnswers = answersBySkill[skill];

        // Define the scoring task as an async function
        const scoreSkillAnswers = async () => {
            try {
                console.log(`Scoring skill: ${skill} using default model`);

                // Call the prompt definition using the default model
                const { output: skillScore } = await scoreSkillPromptDefinition(
                    { skill: skill, answers: skillAnswers }
                    // No model override needed
                );

                if (skillScore && typeof skillScore.score === 'number' && skillScore.reasoning) {
                     // Ensure the skill name matches exactly
                     skillScore.skill = skill;
                    skillScores.push(skillScore);
                    console.log(`Successfully scored skill: ${skill} - Score: ${skillScore.score}`);
                } else {
                    console.warn(`Failed to generate valid score for skill: ${skill}. Output received:`, skillScore);
                     // Add a placeholder score or handle error
                    skillScores.push({ skill: skill, score: 0, reasoning: "Automated scoring failed for this skill." });
                }
            } catch (error: any) {
                 console.error(`Error scoring skill "${skill}":`, error);
                 if (error.message?.includes('API key')) {
                     console.error(`Ensure your GOOGLE_API_KEY is valid and has permissions.`);
                 } else if (error.message?.includes('INVALID_ARGUMENT')) {
                     console.error(`Invalid argument error scoring skill "${skill}". Check prompt/schema. Error:`, error.details);
                 }
                 // Add a placeholder score or handle error
                 skillScores.push({ skill: skill, score: 0, reasoning: "Error during automated scoring." });
            }
        };
        scoringPromises.push(scoreSkillAnswers());
    }

    // Wait for all scoring promises to complete
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

     // Calculate overall score (simple average)
    const totalScore = skillScores.reduce((sum, ss) => sum + ss.score, 0);
    const overallScore = Math.round(totalScore / skillScores.length);

    // Generate overall feedback
    let feedback: string | undefined = "Overall performance summary based on scores."; // Default feedback
     if (skillScores.length > 0) {
         try {
             // Use default model for aggregation
             const { output: aggregationResult } = await aggregateScoresPrompt({
                 skillScores: skillScores,
                 freelancerId: input.freelancerId,
                 testId: input.testId,
             });
             feedback = aggregationResult?.feedback ?? feedback;
             console.log(`Generated overall feedback for test ${input.testId}`);
         } catch (error: any) {
             console.error(`Error generating overall feedback for test ${input.testId}:`, error);
             if (error.message?.includes('API key')) {
                 console.error(`Ensure your GOOGLE_API_KEY is valid and has permissions.`);
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
