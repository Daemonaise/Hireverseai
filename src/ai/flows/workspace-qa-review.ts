'use server';

import { ai } from '@/lib/ai';
import { WorkspaceQAReviewInputSchema, WorkspaceQAReviewOutputSchema } from '@/ai/schemas/workspace-qa-review-schema';
import type { WorkspaceQAReviewInput } from '@/ai/schemas/workspace-qa-review-schema';
import { getAIContext } from '@/services/hub/ai-context';
import { listActivityEvents } from '@/services/hub/activity';

export const workspaceQAReview = ai.defineFlow(
  {
    name: 'workspaceQAReview',
    inputSchema: WorkspaceQAReviewInputSchema,
    outputSchema: WorkspaceQAReviewOutputSchema,
  },
  async (input: WorkspaceQAReviewInput) => {
    const { workspaceId, freelancerId, projectId, submittedWork, projectBrief, microtasks } = input;

    // Load workspace context
    const context = await getAIContext(freelancerId, workspaceId);

    // Fetch recent activity for additional context
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const recentActivity = await listActivityEvents(freelancerId, workspaceId, {
      since: sevenDaysAgo,
      limit: 50,
    });

    const activityContext = recentActivity.length > 0
      ? recentActivity.map(e => `- [${e.sourceProvider}] ${e.title}`).join('\n')
      : 'No recent activity.';

    const microtaskList = microtasks.map((t, i) =>
      `${i + 1}. ${t.description} (Required skill: ${t.requiredSkill})`
    ).join('\n');

    const { output } = await ai.generate({
      prompt: `You are a QA reviewer for Hireverse. Review the submitted work against the project requirements.

## Workspace Context
${context || 'No workspace context available.'}

## Project Brief
${projectBrief}

## Microtasks
${microtaskList}

## Submitted Work
${submittedWork}

## Recent Connected System Activity
${activityContext}

## Instructions
1. Score the work 0-100 based on completeness, quality, and adherence to requirements
2. List specific issues with severity (low/medium/high/critical) and actionable suggestions
3. Set passed=true ONLY if score >= 70 AND there are no critical issues
4. Provide constructive feedback that helps the freelancer improve`,
      output: { schema: WorkspaceQAReviewOutputSchema },
    });

    if (!output) throw new Error('AI did not produce a valid QA review');

    return output;
  }
);
