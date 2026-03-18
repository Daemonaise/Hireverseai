'use server';

import { ai } from '@/lib/ai';
import {
  QaMilestoneReviewInputSchema,
  QaMilestoneReviewOutputSchema,
} from '@/ai/schemas/qa-milestone-review-schema';

export const qaMilestoneReview = ai.defineFlow(
  {
    name: 'qaMilestoneReview',
    inputSchema: QaMilestoneReviewInputSchema,
    outputSchema: QaMilestoneReviewOutputSchema,
  },
  async (input) => {
    const taskSummary = input.completedTasks
      .map((t) => `- Task ${t.taskId} (${t.role}, ${t.freelancerCertLevel}): ${t.description}\n  Submitted: ${t.submittedWork}`)
      .join('\n');

    const { text } = await ai.generate({
      model: 'googleai/gemini-2.0-flash',
      prompt: `You are a QA reviewer for a freelancer marketplace. Review all completed tasks in this milestone against the project requirements.

**Project Brief:**
${input.projectBrief}

**Milestone:** ${input.milestoneName}

**Completed Tasks:**
${taskSummary}

Review each task and the milestone as a whole. Return JSON:
{
  "milestoneId": "${input.milestoneId}",
  "passed": true/false (true if score >= 70),
  "score": 0-100,
  "feedback": "Overall milestone assessment",
  "taskReviews": [{
    "taskId": "...",
    "score": 0-100,
    "feedback": "Task-specific feedback",
    "revisionNeeded": true/false
  }]
}

Scoring criteria per task:
- Completeness (30%): Does the deliverable address all requirements?
- Quality (30%): Is the work professional grade?
- Consistency (20%): Does it align with other tasks in this milestone?
- Brief Alignment (20%): Does it serve the overall project goals?

Milestone passes if overall score >= 70 and no task has revisionNeeded with score < 40.`,
    });

    try {
      const parsed = JSON.parse(text.trim().replace(/```json\n?/g, '').replace(/```/g, ''));
      const score = Math.max(0, Math.min(100, Math.round(parsed.score ?? 0)));
      return {
        milestoneId: input.milestoneId,
        passed: score >= 70,
        score,
        feedback: parsed.feedback || 'Review complete.',
        taskReviews: parsed.taskReviews || [],
      };
    } catch {
      return {
        milestoneId: input.milestoneId,
        passed: false,
        score: 0,
        feedback: 'QA review failed to process.',
        taskReviews: [],
      };
    }
  }
);
