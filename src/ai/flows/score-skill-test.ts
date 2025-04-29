
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

// Correctly import from the ai-instance module
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

// Export types
export type { ScoreSkillTestInput, ScoreSkillTestOutput, Answer, SkillScore };

// Main exported function
export async function scoreSkillTest(input: ScoreSkillTestInput): Promise<ScoreSkillTestOutput> {
    const skillScores: SkillScore[] = [];
    const scoringPromises: Promise<void>[] = [];

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
    for (const skill in answersBySkill) {
        const skillAnswers = answersBySkill[skill];

        const scoreSkillAnswers = async () => {
            try {
                // 1. Choose model
                // Correctly use the imported function
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

Evaluate the following answer(s) provided by the freelancer for questions testing this skill:
${answersText}

Based *only* on the answer(s) above, assess the freelancer's proficiency in "${skill}". Consider accuracy, completeness, clarity, and relevance.
Assign a score from 0 to 100 for this skill.
Provide concise reasoning for the score, highlighting specific strengths or weaknesses observed in the answer(s). Be specific (e.g., "Correctly identified X but missed Y," "Provided a clear explanation of Z," "Answer was too brief and lacked detail").

Output ONLY a JSON object following this structure:
${skillScoreSchemaDescription}
Ensure the 'skill' field is exactly "${skill}".
Do not include any explanations or introductory text outside the JSON object.`;

                // 3. Call AI using the unified function
                const responseString = await callAI(selectedModel, scorePromptText);

                // 4. Parse and validate response
                let skillScore: SkillScore;
                try {
                    const cleanedResponse = responseString.replace(/^```json\n?/, '').replace(/\n?```$/, '');
                    const parsed = JSON.parse(cleanedResponse);
                    skillScore = SkillScoreSchema.parse(parsed);
                    skillScore.skill = skill; // Ensure correct skill
                    skillScores.push(skillScore);
                    console.log(`Successfully scored skill: ${skill} using ${selectedModel} - Score: ${skillScore.score}`);
                } catch (parseError: any) {
                    console.warn(`Failed to parse/validate score for skill: ${skill} using ${selectedModel}. Raw: ${responseString}`, parseError.errors ?? parseError);
                    skillScores.push({ skill: skill, score: 0, reasoning: `Automated scoring failed for this skill using ${selectedModel}.` });
                }

            } catch (error: any) {
                 console.error(`Error scoring skill "${skill}":`, error);
                 skillScores.push({ skill: skill, score: 0, reasoning: "Error during automated scoring." });
            }
        };
        scoringPromises.push(scoreSkillAnswers());
    }

    await Promise.all(scoringPromises);

    // Handle cases where no scores could be generated
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

    // --- Calculate overall score and generate feedback ---
    const totalScore = skillScores.reduce((sum, ss) => sum + ss.score, 0);
    const overallScore = Math.round(totalScore / skillScores.length);

    let feedback: string | undefined = "Overall performance summary based on individual skill scores.";
    try {
        // 1. Choose model for aggregation (usually simpler, default should be fine)
        // Correctly use the imported function
        const aggregationModel = chooseModelBasedOnPrompt("general feedback summary"); // Or use a fixed model like 'googleai/gemini-1.5-flash-latest'
        console.log(`Generating overall feedback for test ${input.testId} using model ${aggregationModel}`);

        // 2. Construct aggregation prompt
        const aggregateSchemaDescription = `{
  "overallScore": ${overallScore},
  "feedback": "Brief overall feedback (1-2 sentences) summarizing performance."
}`;
        const scoresText = skillScores.map(ss => `- Skill: ${ss.skill}\n  Score: ${ss.score}/100\n  Reasoning: ${ss.reasoning}`).join('\n');

        const aggregatePromptText = `You are summarizing the results of a freelancer skill test.
Freelancer ID: ${input.freelancerId}
Test ID: ${input.testId}

Individual Skill Scores:
${scoresText}

The calculated overall score is ${overallScore}/100.
Provide brief (1-2 sentences) overall feedback summarizing the freelancer's performance based ONLY on the provided scores and reasoning.

Output ONLY a JSON object following this structure:
${aggregateSchemaDescription}
Do not include any explanations or introductory text outside the JSON object. Ensure 'overallScore' matches the calculated value.`;

        // 3. Call AI using the unified function
        const feedbackResponseString = await callAI(aggregationModel, aggregatePromptText);

        // 4. Parse and validate feedback response
        try {
            const cleanedFeedbackResponse = feedbackResponseString.replace(/^```json\n?/, '').replace(/\n?```$/, '');
            const aggregationResult = AggregateScoresOutputSchema.parse(JSON.parse(cleanedFeedbackResponse));
            feedback = aggregationResult?.feedback ?? feedback; // Use AI feedback if valid
            console.log(`Generated overall feedback for test ${input.testId} using ${aggregationModel}`);
        } catch (parseError: any) {
            console.error(`Error parsing/validating overall feedback using ${aggregationModel}. Raw: ${feedbackResponseString}`, parseError.errors ?? parseError);
            feedback = "Feedback generation failed."; // Fallback feedback
        }

    } catch (error: any) {
        console.error(`Error generating overall feedback for test ${input.testId}:`, error);
        feedback = "Feedback generation failed due to an API error.";
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
            // Non-fatal error, the flow can still return the scores
        }
    } else {
        console.warn(`No skill scores generated for freelancer ${input.freelancerId}, test ${input.testId}. Skipping Firestore update.`);
    }

    // --- Construct final output ---
    const finalOutput: ScoreSkillTestOutput = {
        overallScore: overallScore,
        skillScores: skillScores,
        feedback: feedback,
    };

    return finalOutput;
}
