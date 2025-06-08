'use server';
/**
 * @fileOverview Scores a freelancer's submitted answers for a skill test.
 * Exports:
 * - scoreSkillTest (async function)
 */

import { ai } from '@/lib/ai'; // Import the configured ai instance
import { chooseModelBasedOnPrompt } from '@/lib/ai-server-helpers'; // Import from correct location
import { validateAIOutput } from '@/ai/validate-output'; // Import from correct location
import { z } from 'zod';
import { updateFreelancerTestScore } from '@/services/firestore';
import {
    ScoreSkillTestInputSchema,
    type ScoreSkillTestInput,
    ScoreSkillTestOutputSchema,
    type ScoreSkillTestOutput,
    type Answer,
    SkillScoreSchema, // Import SkillScore schema
    type SkillScore,
    AggregateScoresOutputSchema, // Schema for AI aggregation output
    type AggregateScoresOutput,
} from '@/ai/schemas/score-skill-test-schema'; // Import types/schemas from separate file


// --- Define Prompt Templates (local constants) ---

// 1. Prompt template to score a single skill based on its answers
const SingleSkillScoreInputSchema = z.object({
    skill: z.string(),
    freelancerId: z.string(),
    answersText: z.string(), // Pre-formatted string of Q&A for the skill
});
// AI outputs score and reasoning for one skill
const SingleSkillScoreAIOutputSchema = SkillScoreSchema.omit({ skill: true }).extend({
  score: z.number().int().min(0).max(100) // Re-validate score range explicitly
});

const scoreSingleSkillPromptTemplate = `You are an expert AI evaluator assessing a freelancer's skill based on their test answers.
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
Do not include any explanations or introductory text outside the JSON object.`;


// 2. Prompt template to aggregate scores and generate overall feedback
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

const aggregateFeedbackPromptTemplate = `You are summarizing the results of a freelancer skill test.
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
Do not include any explanations or introductory text outside the JSON object.`;


// --- Define the Flow (local to this file, not exported) ---
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

      let skillScoreOutput: SkillScore | null = null;
      let scoreModel: string; // Declare model name variable

      try {
          // 1a. Choose model for scoring this skill
          scoreModel = await chooseModelBasedOnPrompt(`Score skill test answers for ${skill}. Answers: ${answersText}`);
          console.log(`Using model ${scoreModel} for scoring skill: ${skill}`);

          // 1b. Define scoring prompt
          const scoreSingleSkillPrompt = ai.definePrompt({
             name: `scoreSingleSkillPrompt_${skill}_${scoreModel.replace(/[^a-zA-Z0-9]/g, '_')}`,
             input: { schema: SingleSkillScoreInputSchema },
             output: { schema: SingleSkillScoreAIOutputSchema },
             prompt: scoreSingleSkillPromptTemplate,
             model: scoreModel,
          });

          // 1c. Call scoring prompt
          const scoreInput = { skill, freelancerId: input.freelancerId, answersText };
          const { output: aiOutput } = await scoreSingleSkillPrompt(scoreInput);

          if (!aiOutput) {
              throw new Error(`AI (${scoreModel}) failed to return valid JSON for skill scoring.`);
          }

          // 1d. Clamp score just in case AI deviates
          aiOutput.score = Math.max(0, Math.min(100, aiOutput.score));

          // 1e. Validate the output with other models
           const originalPromptText = scoreSingleSkillPromptTemplate
              .replace('{{{skill}}}', skill)
              .replace('{{{freelancerId}}}', input.freelancerId)
              .replace('{{{answersText}}}', answersText);

          // validateAIOutput is async and exported from its own 'use server' file
          const validation = await validateAIOutput(originalPromptText, JSON.stringify(aiOutput), scoreModel as any); // Cast primaryModel

          if (!validation.allValid) {
              console.warn(`Validation failed for skill scoring (skill: ${skill}). Reasoning:`, validation.results);
              throw new Error(`Skill scoring for "${skill}" failed cross-validation.`);
          }

          skillScoreOutput = {
              skill: skill,
              score: aiOutput.score,
              reasoning: aiOutput.reasoning,
          };
          console.log(`Successfully scored and validated skill: ${skill} - Score: ${skillScoreOutput.score}`);
          return skillScoreOutput;

      } catch (error: any) {
           console.error(`Error during scoring setup, AI call, or validation for skill "${skill}":`, error?.message || error);
           // Return error state for this skill
           return { skill: skill, score: 0, reasoning: `Error during automated scoring: ${error?.message || 'Unknown error'}.` };
      }
    });

    // Wait for all skill scoring to complete
    const skillScores = await Promise.all(skillScorePromises);

    // --- Aggregate scores and generate feedback ---
    let overallScore = 0;
    let feedback = "No skills were scored.";
    let finalFeedback = feedback; // Variable to hold validated feedback

    if (skillScores.length > 0 && skillScores.some(s => s.score > 0 || !s.reasoning.startsWith('Error'))) { // Check if any scoring was successful
        const validScores = skillScores.filter(s => !s.reasoning.startsWith('Error'));
        const totalScore = validScores.reduce((sum, ss) => sum + ss.score, 0);
        overallScore = Math.round(validScores.length > 0 ? totalScore / validScores.length : 0);

        const scoresText = skillScores.map(ss => `- Skill: ${ss.skill}\n  Score: ${ss.score}/100\n  Reasoning: ${ss.reasoning}`).join('\n');
        let feedbackModel: string; // Declare model name variable

        try {
            // 2a. Choose model for feedback generation
            feedbackModel = await chooseModelBasedOnPrompt(`Summarize test results: ${scoresText}`);
            console.log(`Using model ${feedbackModel} for feedback aggregation.`);

            // 2b. Define feedback prompt
            const aggregateFeedbackPrompt = ai.definePrompt({
                name: `aggregateFeedbackPrompt_${input.testId}_${feedbackModel.replace(/[^a-zA-Z0-9]/g, '_')}`,
                input: { schema: AggregateFeedbackInputSchema },
                output: { schema: AggregateFeedbackAIOutputSchema },
                prompt: aggregateFeedbackPromptTemplate,
                model: feedbackModel,
            });

            // 2c. Call feedback prompt
            const feedbackInput = { freelancerId: input.freelancerId, testId: input.testId, overallScore: overallScore, scoresText: scoresText };
            const { output: feedbackOutput } = await aggregateFeedbackPrompt(feedbackInput);

             if (!feedbackOutput?.feedback) {
                throw new Error(`AI (${feedbackModel}) failed to return valid JSON for feedback aggregation.`);
             }
             feedback = feedbackOutput.feedback;

             // 2d. Validate the output with other models
              const originalPromptText = aggregateFeedbackPromptTemplate
                  .replace('{{{freelancerId}}}', input.freelancerId)
                  .replace('{{{testId}}}', input.testId)
                  .replace('{{{overallScore}}}', overallScore.toString())
                  .replace('{{{scoresText}}}', scoresText);

             // validateAIOutput is async and exported from its own 'use server' file
             const validation = await validateAIOutput(originalPromptText, JSON.stringify(feedbackOutput), feedbackModel as any); // Cast primaryModel

             if (!validation.allValid) {
                 console.warn(`Validation failed for feedback aggregation (test ID: ${input.testId}). Reasoning:`, validation.results);
                 // Use fallback feedback if validation fails
                 finalFeedback = `Overall score is ${overallScore}/100. Individual skill feedback available. (Feedback summary validation failed).`;
             } else {
                finalFeedback = feedback; // Use validated feedback
                console.log(`Generated and validated overall feedback for test ${input.testId}.`);
             }


        } catch (error: any) {
            console.error(`Error generating or validating overall feedback for test ${input.testId}:`, error?.message || error);
            finalFeedback = `Feedback generation/validation failed due to an API error: ${error?.message || 'Unknown error'}.`;
        }
    } else {
         finalFeedback = input.answers.length === 0
            ? `No answers submitted for scoring.`
            : `Error: Could not score any skills.`;
        console.warn(`${finalFeedback} for test ${input.testId}`);
    }


    // --- Update Firestore ---
    const successfulScores = skillScores.filter(s => !s.reasoning.startsWith('Error'));
    if (successfulScores.length > 0) {
        try {
            const updatePromises = successfulScores.map(skillScore =>
                updateFreelancerTestScore(input.freelancerId, skillScore.skill, skillScore.score)
            );
            await Promise.all(updatePromises);
            console.log(`Successfully updated ${successfulScores.length} test scores in Firestore for freelancer ${input.freelancerId}`);
        } catch (error) {
            console.error(`Failed to update one or more scores in Firestore for freelancer ${input.freelancerId}:`, error);
        }
    } else {
        console.warn(`No successful skill scores generated for freelancer ${input.freelancerId}, test ${input.testId}. Skipping Firestore update.`);
    }

    // --- Construct final output ---
    const finalOutput: ScoreSkillTestOutput = {
        overallScore,
        skillScores, // Include all scores, even errors
        feedback: finalFeedback, // Use the potentially validated feedback
    };

    // Validate final output before returning
    ScoreSkillTestOutputSchema.parse(finalOutput);

    return finalOutput;
  }
);


// --- Main Exported Function (Wrapper - Async) ---
// This is the only export from this file.
export async function scoreSkillTest(input: ScoreSkillTestInput): Promise<ScoreSkillTestOutput> {
    // Input validation handled by the flow
    ScoreSkillTestInputSchema.parse(input);
    return scoreSkillTestFlow(input);
}
