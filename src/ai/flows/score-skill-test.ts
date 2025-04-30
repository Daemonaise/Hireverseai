'use server';
/**
 * @fileOverview Scores a freelancer's submitted answers for a skill test.
 * Uses dynamic model selection based on the skill being scored.
 *
 * Exports:
 * - scoreSkillTest - A function that handles the scoring process and updates Firestore.
 * - ScoreSkillTestInput - Input type.
 * - ScoreSkillTestOutput - Output type.
 * - Answer - Answer structure type.
 * - SkillScore - SkillScore structure type.
 */

import { ai } from '@/ai/ai-instance'; // Import ai instance
import { chooseModelBasedOnPrompt } from '@/lib/model-selector';
import { z } from 'zod'; // Use standard zod import
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

// --- Helper: Score answers for a single skill ---
// This is an internal async helper, not exported
async function scoreSingleSkill(skill: string, skillAnswers: Answer[], freelancerId: string): Promise<SkillScore> {
    try {
        // 1. Choose model based on the skill (uses centralized logic)
        const selectedModel = chooseModelBasedOnPrompt(skill);
        console.log(`Scoring skill: ${skill} using model: ${selectedModel}`);

        // Define the Genkit prompt for scoring this skill
        const scoreSkillPrompt = ai.definePrompt({
            name: `scoreSkill_${skill.replace(/[^a-zA-Z0-9]/g, '')}`,
            input: { schema: z.object({ skill: z.string(), freelancerId: z.string(), answersText: z.string() }) },
            output: { schema: SkillScoreSchema.omit({ skill: true }).extend({ score: z.number().int().min(0).max(100) }) }, // AI outputs score & reasoning
            model: selectedModel,
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
  "score": "Integer score from 0 to 100",
  "reasoning": "Concise reasoning for the score based on provided answers."
}
Ensure 'score' is between 0 and 100.
Do not include any explanations or introductory text outside the JSON object.`,
        });

        const answersText = skillAnswers.map(a => `---
Question: ${a.questionText}
Answer: ${a.answerText}
---`).join('\n');

        // 3. Call AI using the defined prompt
        try {
            const { output: aiOutput } = await scoreSkillPrompt({ skill, freelancerId, answersText });

            if (!aiOutput || typeof aiOutput.score !== 'number' || typeof aiOutput.reasoning !== 'string') {
                throw new Error(`AI (${selectedModel}) returned invalid structure for skill scoring.`);
            }

            // 4. Construct the final SkillScore object
            const validatedSkillScore: SkillScore = {
                skill: skill, // Add the skill back
                score: Math.max(0, Math.min(100, aiOutput.score)), // Clamp score
                reasoning: aiOutput.reasoning,
            };

            console.log(`Successfully scored skill: ${skill} using ${selectedModel} - Score: ${validatedSkillScore.score}`);
            return validatedSkillScore;

        } catch (aiError: any) {
            console.warn(`Failed to get/validate score for skill: ${skill} using ${selectedModel}.`, aiError.message ?? aiError);
            // Return a default error score that conforms to the schema
            return { skill: skill, score: 0, reasoning: `Automated scoring failed for this skill using ${selectedModel}.` };
        }

    } catch (error: any) {
         console.error(`Error during scoring setup for skill "${skill}":`, error);
         // Return a default error score that conforms to the schema
         return { skill: skill, score: 0, reasoning: "Error during automated scoring." };
    }
}


// --- Helper: Aggregate scores and generate overall feedback ---
// This is an internal async helper, not exported
async function aggregateScoresAndFeedback(skillScores: SkillScore[], freelancerId: string, testId: string): Promise<AggregateScoresOutput> {
    if (skillScores.length === 0) {
        return { overallScore: 0, feedback: "No skills were scored." };
    }

    const totalScore = skillScores.reduce((sum, ss) => sum + ss.score, 0);
    const overallScore = Math.round(totalScore / skillScores.length);

    try {
        // Choose model for aggregation (often simpler, default is fine)
        const aggregationModel = chooseModelBasedOnPrompt("general feedback summary"); // Use centralized logic
        console.log(`Generating overall feedback for test ${testId} using model ${aggregationModel}`);

        // Define the Genkit prompt for aggregation
        const aggregateFeedbackPrompt = ai.definePrompt({
            name: `aggregateFeedback_${testId}`,
            input: { schema: z.object({ freelancerId: z.string(), testId: z.string(), scoresText: z.string(), overallScore: z.number() }) },
            output: { schema: AggregateScoresOutputSchema.pick({ feedback: true }) }, // AI only outputs feedback
            model: aggregationModel,
            prompt: `You are summarizing the results of a freelancer skill test.
Freelancer ID: {{{freelancerId}}}
Test ID: {{{testId}}}

Individual Skill Scores:
{{{scoresText}}}

The calculated overall score is {{{overallScore}}}/100.
Provide brief (1-2 sentences) overall feedback summarizing the freelancer's performance based ONLY on the provided scores and reasoning. Ensure 'feedback' is a non-empty string.

Output ONLY a JSON object following this structure:
{
  "feedback": "Brief overall feedback (1-2 sentences) summarizing performance."
}
Do not include any explanations or introductory text outside the JSON object.`,
        });

        const scoresText = skillScores.map(ss => `- Skill: ${ss.skill}\n  Score: ${ss.score}/100\n  Reasoning: ${ss.reasoning}`).join('\n');

        // Call AI using the defined prompt
        try {
            const { output: aiOutput } = await aggregateFeedbackPrompt({ freelancerId, testId, scoresText, overallScore });

             if (!aiOutput || typeof aiOutput.feedback !== 'string') {
                throw new Error(`AI (${aggregationModel}) returned invalid feedback structure.`);
             }

            // Construct the full Aggregation output
             const aggregationResult: AggregateScoresOutput = {
                 overallScore: overallScore, // Use calculated score
                 feedback: aiOutput.feedback,
             };

            console.log(`Generated overall feedback for test ${testId} using ${aggregationModel}`);
            return aggregationResult;

        } catch (aiError: any) {
            console.error(`Error parsing/validating overall feedback using ${aggregationModel}.`, aiError.message ?? aiError);
            // Return fallback feedback conforming to schema
            return { overallScore: overallScore, feedback: "Feedback generation failed due to invalid AI response." };
        }

    } catch (error: any) {
        console.error(`Error generating overall feedback for test ${testId}:`, error);
        // Return fallback feedback conforming to schema
        return { overallScore: overallScore, feedback: "Feedback generation failed due to an API error." };
    }
}


// --- Main Exported Function ---
// Export only the async function
export async function scoreSkillTest(input: ScoreSkillTestInput): Promise<ScoreSkillTestOutput> {
    // Validate input (optional, often handled by caller/framework)
    ScoreSkillTestInputSchema.parse(input);

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

    // --- Score each skill individually using the helper ---
    const scoringPromises = Object.entries(answersBySkill).map(([skill, answers]) =>
        scoreSingleSkill(skill, answers, input.freelancerId)
    );

    // Wait for all skill scoring to complete
    const skillScores = await Promise.all(scoringPromises);

    // Handle cases where no scores could be generated or no answers submitted
    if (skillScores.length === 0) {
        const feedback = input.answers.length === 0
            ? "No answers submitted for scoring."
            : "Error: Could not score any skills.";
        console.warn(`${feedback} for test ${input.testId}`);
        return { overallScore: 0, skillScores: [], feedback };
    }

    // --- Aggregate scores and generate feedback using the helper ---
    const { overallScore, feedback } = await aggregateScoresAndFeedback(skillScores, input.freelancerId, input.testId);

    // --- Update Firestore ---
    if (skillScores.length > 0) {
        try {
            // Update scores in Firestore concurrently
            const updatePromises = skillScores.map(skillScore =>
                updateFreelancerTestScore(input.freelancerId, skillScore.skill, skillScore.score)
            );
            await Promise.all(updatePromises);
            console.log(`Successfully updated all test scores in Firestore for freelancer ${input.freelancerId}`);
        } catch (error) {
            console.error(`Failed to update one or more scores in Firestore for freelancer ${input.freelancerId}:`, error);
            // Non-fatal error for the flow's return value, but should be monitored
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

    // Validate final output before returning (optional)
    ScoreSkillTestOutputSchema.parse(finalOutput);

    return finalOutput;
}
