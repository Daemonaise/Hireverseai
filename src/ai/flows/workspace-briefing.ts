'use server';

import { ai } from '@/lib/ai';
import { withRetry } from '@/lib/ai-retry';
import { WorkspaceBriefingInputSchema, WorkspaceBriefingOutputSchema } from '@/ai/schemas/workspace-briefing-schema';
import type { WorkspaceBriefingInput } from '@/ai/schemas/workspace-briefing-schema';
import { getAIContext, generateAIContext } from '@/services/hub/ai-context';
import { listActivityEvents } from '@/services/hub/activity';
import { listNotes } from '@/services/hub/notes';
import { storeBriefing } from '@/services/hub/briefings';
import { Timestamp } from 'firebase/firestore';

export const workspaceBriefing = ai.defineFlow(
  {
    name: 'workspaceBriefing',
    inputSchema: WorkspaceBriefingInputSchema,
    outputSchema: WorkspaceBriefingOutputSchema,
  },
  async (input: WorkspaceBriefingInput) => {
    const { workspaceId, freelancerId, periodStart, periodEnd } = input;

    // Load or generate AI context
    let context = await getAIContext(freelancerId, workspaceId);
    if (!context) {
      context = await generateAIContext(freelancerId, workspaceId);
    }

    // Fetch activity events for the period
    const since = new Date(periodStart);
    const events = await listActivityEvents(freelancerId, workspaceId, { since, limit: 200 });

    // Fetch notes
    const notes = await listNotes(freelancerId, workspaceId);

    // Build prompt content
    const eventSummary = events.length > 0
      ? events.map(e => `- [${e.sourceProvider}] ${e.title}: ${e.bodyExcerpt}`).join('\n')
      : 'No activity events in this period.';

    const notesSummary = notes.length > 0
      ? notes.map(n => `- ${n.title}: ${n.content.substring(0, 100)}`).join('\n')
      : 'No notes.';

    const { output } = await withRetry(() => ai.generate({
      model: 'vertexai/gemini-2.0-flash',
      prompt: `You are the Hireverse Workspace Assistant generating a briefing for the period ${periodStart} to ${periodEnd}.

## Workspace Context
${context}

## Activity Events (${events.length} total)
${eventSummary}

## Notes
${notesSummary}

Generate a structured briefing with:
1. A summary paragraph covering key activity and progress
2. Prioritized action items (sorted by urgency — most urgent first)
3. Identified blockers or risks

Be specific and actionable. Reference actual events and data.`,
      output: { schema: WorkspaceBriefingOutputSchema },
    }));

    if (!output) throw new Error('AI did not produce a valid briefing');

    // Store the briefing
    await storeBriefing(freelancerId, workspaceId, {
      generatedAt: Timestamp.now(),
      periodStart: Timestamp.fromDate(since),
      periodEnd: Timestamp.fromDate(new Date(periodEnd)),
      summary: output.summary,
      actionItems: output.actionItems,
      blockers: output.blockers,
      model: 'vertexai/gemini-2.0-flash',
    });

    return output;
  }
);
