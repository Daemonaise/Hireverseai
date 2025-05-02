'use server';
/**
 * @fileOverview Scores a freelancer's submitted answers for a skill test.
 * Uses dynamic model selection via callAI.
 *
 * Exports:
 * - scoreSkillTest - A function that handles the scoring process and updates Firestore.
 * - ScoreSkillTestInput - Input type.
 * - ScoreSkillTestOutput - Output type.
 * - Answer - Answer structure type.
 * - SkillScore - SkillScore structure type.
 */

import { callAI } from '@/ai/ai-instance'; // Import the centralized callAI function
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

// --- Helper: Extract JSON from potentially messy AI output ---
function extractJson(text: string): unknown | null {
    const match = text.match(/\{[\s\S]*\}/); // Basic object match
    if (match) {
        try {
            return JSON.parse(match[0]);
        } catch (e) {
            console.warn("JSON parsing failed:", e, "Raw Text:", text);
            return null;
        }
    }
    console.error("Could not find any JSON object in AI response:", text);
    return null;
}


// --- Helper: Score answers for a single skill ---
// This is an internal async helper, not exported
async function scoreSingleSkill(skill: string, skillAnswers: Answer[], freelancerId: string): Promise<SkillScore> {
    try {
        console.log(`Scoring skill: ${skill}...`);

        const answersText = skillAnswers.map(a => `---
Question: ${a.questionText}
Answer: ${a.answerText}
---`).join('\n');

        // Construct the prompt for callAI
        const promptText = `You are an expert AI evaluator assessing a freelancer's skill based on their test answers.
Skill being evaluated: ${skill}
Freelancer ID: ${freelancerId}

Evaluate the following answer(s) provided by the freelancer for questions testing this skill:
${answersText}

Based *only* on the answer(s) above, assess the freelancer's proficiency in "${skill}". Consider accuracy, completeness, clarity, and relevance.
Assign a score from 0 to 100 for this skill.
Provide concise reasoning for the score, highlighting specific strengths or weaknesses observed in the answer(s). Be specific (e.g., "Correctly identified X but missed Y," "Provided a clear explanation of Z," "Answer was too brief and lacked detail").

Output ONLY a JSON object following this structure:
{
  "score": Integer score from 0 to 100,
  "reasoning": "Concise reasoning for the score based on provided answers (string)."
}
Ensure 'score' is between 0 and 100.
Do not include any explanations or introductory text outside the JSON object.`;

        // Call AI using the centralized function
        const responseText = await callAI(promptText);

        // Parse and validate the response
        let aiOutput: Omit<SkillScore, 'skill'>;
        try {
            const parsedJson = extractJson(responseText);
            if (!parsedJson) throw new Error("AI failed to return valid JSON for skill scoring.");

            const validationResult = SkillScoreSchema.omit({ skill: true }).extend({
                score: z.number().int().min(0).max(100) // Re-validate score range explicitly
            }).safeParse(parsedJson);

            if (!validationResult.success) {
                 throw new Error(`Invalid score structure: ${validationResult.error.errors.map(e => e.message).join(', ')}`);
            }
            aiOutput = validationResult.data;

            // Clamp score just in case AI deviates despite prompt
             aiOutput.score = Math.max(0, Math.min(100, aiOutput.score));

        } catch (parseError: any) {
            console.warn(`Failed to parse/validate score for skill: ${skill}.`, parseError.message, "Raw Response:", responseText);
            // Return a default error score that conforms to the schema
            return { skill: skill, score: 0, reasoning: `Automated scoring failed for this skill due to invalid response format.` };
        }


        // Construct the final SkillScore object
        const validatedSkillScore: SkillScore = {
            skill: skill, // Add the skill back
            score: aiOutput.score,
            reasoning: aiOutput.reasoning,
        };

        console.log(`Successfully scored skill: ${skill} - Score: ${validatedSkillScore.score}`);
        return validatedSkillScore;

    } catch (error: any) {
         console.error(`Error during scoring setup or AI call for skill "${skill}":`, error?.message || error);
         // Return a default error score that conforms to the schema
         return { skill: skill, score: 0, reasoning: `Error during automated scoring: ${error?.message || 'Unknown error'}.` };
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
        console.log(`Generating overall feedback for test ${testId}...`);

        const scoresText = skillScores.map(ss => `- Skill: ${ss.skill}\n  Score: ${ss.score}/100\n  Reasoning: ${ss.reasoning}`).join('\n');

        // Construct the prompt for callAI
        const promptText = `You are summarizing the results of a freelancer skill test.
Freelancer ID: ${freelancerId}
Test ID: ${testId}

Individual Skill Scores:
${scoresText}

The calculated overall score is ${overallScore}/100.
Provide brief (1-2 sentences) overall feedback summarizing the freelancer's performance based ONLY on the provided scores and reasoning. Ensure 'feedback' is a non-empty string.

Output ONLY a JSON object following this structure:
{
  "feedback": "Brief overall feedback (1-2 sentences) summarizing performance (string, non-empty)."
}
Do not include any explanations or introductory text outside the JSON object.`;

        // Call AI using the centralized function
        const responseText = await callAI(promptText);

        // Parse and validate the response
        let aiOutput: Pick<AggregateScoresOutput, 'feedback'>;
        try {
            const parsedJson = extractJson(responseText);
            if (!parsedJson) throw new Error("AI failed to return valid JSON for feedback aggregation.");

            // Validate the structure - expect only feedback
            const validationResult = AggregateScoresOutputSchema.pick({ feedback: true }).extend({
                feedback: z.string().min(1) // Ensure feedback is non-empty
            }).safeParse(parsedJson);

            if (!validationResult.success) {
                throw new Error(`Invalid feedback structure: ${validationResult.error.errors.map(e => e.message).join(', ')}`);
            }
            aiOutput = validationResult.data;

        } catch (parseError: any) {
             console.error(`Error parsing/validating overall feedback.`, parseError.message, "Raw Response:", responseText);
             // Return fallback feedback conforming to schema
             return { overallScore: overallScore, feedback: "Feedback generation failed due to invalid AI response." };
        }


        // Construct the full Aggregation output
        const aggregationResult: AggregateScoresOutput = {
            overallScore: overallScore, // Use calculated score
            feedback: aiOutput.feedback,
        };

        console.log(`Generated overall feedback for test ${testId}.`);
        return aggregationResult;

    } catch (error: any) {
        console.error(`Error generating overall feedback for test ${testId}:`, error?.message || error);
        // Return fallback feedback conforming to schema
        return { overallScore: overallScore, feedback: `Feedback generation failed due to an API error: ${error?.message || 'Unknown error'}.` };
    }
}


// --- Main Exported Function ---
export async function scoreSkillTest(input: ScoreSkillTestInput): Promise<ScoreSkillTestOutput> {
    // Validate input
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
        // Ensure the output matches the schema even in error cases
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

    // Validate final output before returning
    ScoreSkillTestOutputSchema.parse(finalOutput);

    return finalOutput;
}
    
