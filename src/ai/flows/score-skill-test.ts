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

import { callAI } from '@/ai/ai-instance';
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

        // 2. Construct prompt for scoring this skill
        const skillScoreSchemaDescription = `{
  "skill": "${skill}",
  "score": "Integer score from 0 to 100",
  "reasoning": "Concise reasoning for the score based on provided answers."
}`;
        const answersText = skillAnswers.map(a => `---
Question: ${a.questionText}
Answer: ${a.answerText}
---`).join('\n');

        const scorePromptText = `You are an expert AI evaluator assessing a freelancer's skill based on their test answers.
Skill being evaluated: ${skill}
Freelancer ID: ${freelancerId}

Evaluate the following answer(s) provided by the freelancer for questions testing this skill:
${answersText}

Based *only* on the answer(s) above, assess the freelancer's proficiency in "${skill}". Consider accuracy, completeness, clarity, and relevance.
Assign a score from 0 to 100 for this skill.
Provide concise reasoning for the score, highlighting specific strengths or weaknesses observed in the answer(s). Be specific (e.g., "Correctly identified X but missed Y," "Provided a clear explanation of Z," "Answer was too brief and lacked detail").

Output ONLY a JSON object following this structure:
${skillScoreSchemaDescription}
Ensure the 'skill' field is exactly "${skill}". Ensure 'score' is between 0 and 100.
Do not include any explanations or introductory text outside the JSON object.`;

        // 3. Call AI using the unified function
        const responseString = await callAI('auto', scorePromptText); // Let model selector choose

        // 4. Parse and validate response
        try {
            const cleanedResponse = responseString.replace(/^```json\n?/, '').replace(/\n?```$/, '');
            const parsed = JSON.parse(cleanedResponse);
            const validatedSkillScore = SkillScoreSchema.parse(parsed);

            // Ensure correct skill and score range, overriding if needed
            validatedSkillScore.skill = skill;
            validatedSkillScore.score = Math.max(0, Math.min(100, validatedSkillScore.score)); // Clamp score

            console.log(`Successfully scored skill: ${skill} using ${selectedModel} - Score: ${validatedSkillScore.score}`);
            return validatedSkillScore;

        } catch (parseError: any) {
            console.warn(`Failed to parse/validate score for skill: ${skill} using ${selectedModel}. Raw: ${responseString}`, parseError.errors ?? parseError);
            // Return a default error score that conforms to the schema
            return { skill: skill, score: 0, reasoning: `Automated scoring failed for this skill using ${selectedModel}.` };
        }

    } catch (error: any) {
         console.error(`Error during scoring for skill "${skill}":`, error);
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
        // Choose model for aggregation (often simpler, 'auto' or default is fine)
        const aggregationModel = chooseModelBasedOnPrompt("general feedback summary"); // Use centralized logic
        console.log(`Generating overall feedback for test ${testId} using model ${aggregationModel}`);

        // Construct aggregation prompt
        const aggregateSchemaDescription = `{
  "overallScore": ${overallScore},
  "feedback": "Brief overall feedback (1-2 sentences) summarizing performance."
}`;
        const scoresText = skillScores.map(ss => `- Skill: ${ss.skill}\n  Score: ${ss.score}/100\n  Reasoning: ${ss.reasoning}`).join('\n');

        const aggregatePromptText = `You are summarizing the results of a freelancer skill test.
Freelancer ID: ${freelancerId}
Test ID: ${testId}

Individual Skill Scores:
${scoresText}

The calculated overall score is ${overallScore}/100.
Provide brief (1-2 sentences) overall feedback summarizing the freelancer's performance based ONLY on the provided scores and reasoning. Ensure 'feedback' is a non-empty string.

Output ONLY a JSON object following this structure:
${aggregateSchemaDescription}
Do not include any explanations or introductory text outside the JSON object. Ensure 'overallScore' matches the calculated value.`;

        // Call AI using the unified function
        const feedbackResponseString = await callAI('auto', aggregatePromptText); // Let model selector choose

        // Parse and validate feedback response
        try {
            const cleanedFeedbackResponse = feedbackResponseString.replace(/^```json\n?/, '').replace(/\n?```$/, '');
            const parsed = JSON.parse(cleanedFeedbackResponse);
            const aggregationResult = AggregateScoresOutputSchema.parse(parsed);

             // Ensure overallScore matches calculation, overriding if needed
             aggregationResult.overallScore = overallScore;

            console.log(`Generated overall feedback for test ${testId} using ${aggregationModel}`);
            return aggregationResult;

        } catch (parseError: any) {
            console.error(`Error parsing/validating overall feedback using ${aggregationModel}. Raw: ${feedbackResponseString}`, parseError.errors ?? parseError);
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
    // ScoreSkillTestInputSchema.parse(input);

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
    // ScoreSkillTestOutputSchema.parse(finalOutput);

    return finalOutput;
}
