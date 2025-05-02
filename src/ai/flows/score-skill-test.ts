'use server';
/**
 * @fileOverview Scores a freelancer's submitted answers for a skill test.
 */

import { ai } from '@/ai/ai-instance'; // Import the configured ai instance
import { z } from 'zod';
import { updateFreelancerTestScore } from '@/services/firestore';
import {
    ScoreSkillTestInputSchema,
    type ScoreSkillTestInput,
    ScoreSkillTestOutputSchema,
    type ScoreSkillTestOutput,
    AnswerSchema,
    type Answer,
    SkillScoreSchema,
    type SkillScore,
    AggregateScoresOutputSchema, // Schema for AI aggregation output
    type AggregateScoresOutput,
} from '@/ai/schemas/score-skill-test-schema';

// Export types separately
export type { ScoreSkillTestInput, ScoreSkillTestOutput, Answer, SkillScore };


// --- Define Prompts ---

// 1. Prompt to score a single skill based on its answers
const SingleSkillScoreInputSchema = z.object({
    skill: z.string(),
    freelancerId: z.string(),
    answersText: z.string(), // Pre-formatted string of Q&A for the skill
});
// AI outputs score and reasoning for one skill
const SingleSkillScoreAIOutputSchema = SkillScoreSchema.omit({ skill: true }).extend({
  score: z.number().int().min(0).max(100) // Re-validate score range explicitly
});

const scoreSingleSkillPrompt = ai.definePrompt({
    name: 'scoreSingleSkillPrompt',
    input: { schema: SingleSkillScoreInputSchema },
    output: { schema: SingleSkillScoreAIOutputSchema },
    // model: 'googleai/gemini-1.5-flash', // Example: Specify model
    prompt: `You are an expert AI evaluator assessing a freelancer's skill based on their test answers.
Skill being evaluated: {{{skill}}}
Freelancer ID: {{{freelancerId}}}

Evaluate the following answer(s) provided by the freelancer for questions testing this skill:
{{{answersText}}}

Based *only* on the answer(s) above, assess the freelancer's proficiency in "{{{skill}}}". Consider accuracy, completeness, clarity, and relevance.
Assign a score from 0 to 100 for this skill.
Provide concise reasoning for the score, highlighting specific strengths or weaknesses observed in the answer(s). Be specific (e.g., "Correctly identified X but missed Y," "Provided a clear explanation of Z," "Answer was too brief and lacked detail").

Output ONLY a JSON object following this structure:
{
  "score": Integer score from 0 to 100,
  "reasoning": "Concise reasoning for the score based on provided answers (string)."
}
Ensure 'score' is between 0 and 100.
Do not include any explanations or introductory text outside the JSON object.`,
});


// 2. Prompt to aggregate scores and generate overall feedback
const AggregateFeedbackInputSchema = z.object({
    freelancerId: z.string(),
    testId: z.string(),
    overallScore: z.number().int().min(0).max(100),
    scoresText: z.string(), // Pre-formatted string of individual scores and reasoning
});
// AI outputs just the feedback string
const AggregateFeedbackAIOutputSchema = AggregateScoresOutputSchema.pick({ feedback: true }).extend({
    feedback: z.string().min(1) // Ensure feedback is non-empty
});

const aggregateFeedbackPrompt = ai.definePrompt({
    name: 'aggregateFeedbackPrompt',
    input: { schema: AggregateFeedbackInputSchema },
    output: { schema: AggregateFeedbackAIOutputSchema },
    // model: 'googleai/gemini-1.5-flash', // Example: Specify model
    prompt: `You are summarizing the results of a freelancer skill test.
Freelancer ID: {{{freelancerId}}}
Test ID: {{{testId}}}

Individual Skill Scores:
{{{scoresText}}}

The calculated overall score is {{{overallScore}}}/100.
Provide brief (1-2 sentences) overall feedback summarizing the freelancer's performance based ONLY on the provided scores and reasoning. Ensure 'feedback' is a non-empty string.

Output ONLY a JSON object following this structure:
{
  "feedback": "Brief overall feedback (1-2 sentences) summarizing performance (string, non-empty)."
}
Do not include any explanations or introductory text outside the JSON object.`,
});



// --- Define the Flow ---
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
    console.log(`Scoring test ${input.testId} for Freelancer ${input.freelancerId}`);

    // Group answers by skill
    const answersBySkill = input.answers.reduce((acc, answer) => {
        const currentSkill = answer.skillTested;
        if (!acc[currentSkill]) {
            acc[currentSkill] = [];
        }
        acc[currentSkill].push(answer);
        return acc;
    }, {} as Record<string, Answer[]>);

    // --- Score each skill individually ---
    const skillScorePromises = Object.entries(answersBySkill).map(async ([skill, answers]) => {
      const answersText = answers.map(a => `---
Question: ${a.questionText}
Answer: ${a.answerText}
---`).join('\n');

      try {
          const { output: aiOutput } = await scoreSingleSkillPrompt({
              skill,
              freelancerId: input.freelancerId,
              answersText,
          });

          if (!aiOutput) {
              throw new Error("AI failed to return valid JSON for skill scoring.");
          }

           // Clamp score just in case AI deviates despite prompt
          aiOutput.score = Math.max(0, Math.min(100, aiOutput.score));

          const validatedSkillScore: SkillScore = {
              skill: skill,
              score: aiOutput.score,
              reasoning: aiOutput.reasoning,
          };
          console.log(`Successfully scored skill: ${skill} - Score: ${validatedSkillScore.score}`);
          return validatedSkillScore;

      } catch (error: any) {
           console.error(`Error during scoring setup or AI call for skill "${skill}":`, error?.message || error);
           return { skill: skill, score: 0, reasoning: `Error during automated scoring: ${error?.message || 'Unknown error'}.` };
      }
    });

    // Wait for all skill scoring to complete
    const skillScores = await Promise.all(skillScorePromises);

    // --- Aggregate scores and generate feedback ---
    let overallScore = 0;
    let feedback = "No skills were scored.";

    if (skillScores.length > 0) {
        const totalScore = skillScores.reduce((sum, ss) => sum + ss.score, 0);
        overallScore = Math.round(totalScore / skillScores.length);

        const scoresText = skillScores.map(ss => `- Skill: ${ss.skill}\n  Score: ${ss.score}/100\n  Reasoning: ${ss.reasoning}`).join('\n');

        try {
            const { output: feedbackOutput } = await aggregateFeedbackPrompt({
                freelancerId: input.freelancerId,
                testId: input.testId,
                overallScore: overallScore,
                scoresText: scoresText,
            });

             if (!feedbackOutput?.feedback) {
                throw new Error("AI failed to return valid JSON for feedback aggregation.");
             }
             feedback = feedbackOutput.feedback;
             console.log(`Generated overall feedback for test ${input.testId}.`);

        } catch (error: any) {
            console.error(`Error generating overall feedback for test ${input.testId}:`, error?.message || error);
            feedback = `Feedback generation failed due to an API error: ${error?.message || 'Unknown error'}.`;
        }
    } else {
         feedback = input.answers.length === 0
            ? "No answers submitted for scoring."
            : "Error: Could not score any skills.";
        console.warn(`${feedback} for test ${input.testId}`);
    }


    // --- Update Firestore ---
    if (skillScores.length > 0) {
        try {
            const updatePromises = skillScores.map(skillScore =>
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

    // --- Construct final output ---
    const finalOutput: ScoreSkillTestOutput = {
        overallScore,
        skillScores,
        feedback,
    };

    // Validate final output before returning
    ScoreSkillTestOutputSchema.parse(finalOutput);

    return finalOutput;
  }
);


// --- Main Exported Function (Wrapper) ---
export async function scoreSkillTest(input: ScoreSkillTestInput): Promise<ScoreSkillTestOutput> {
    // Input validation handled by the flow
    ScoreSkillTestInputSchema.parse(input);
    return scoreSkillTestFlow(input);
}
