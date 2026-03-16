'use server';

import { ai } from '@/lib/ai';
import { WorkspaceChatInputSchema, WorkspaceChatOutputSchema } from '@/ai/schemas/workspace-chat-schema';
import type { WorkspaceChatInput } from '@/ai/schemas/workspace-chat-schema';
import { getAIContext, generateAIContext } from '@/services/hub/ai-context';
import { listActivityEvents } from '@/services/hub/activity';
import { listConnections } from '@/services/hub/connections';
import { getLatestBriefing } from '@/services/hub/briefings';
import { listNotes } from '@/services/hub/notes';
import { listBookmarks } from '@/services/hub/bookmarks';
import { z } from 'zod';

// Define tools for the chat agent
const listActivityEventsTool = ai.defineTool(
  {
    name: 'listActivityEvents',
    description: 'Query activity events by type, provider, or date range',
    inputSchema: z.object({
      provider: z.string().optional(),
      sourceType: z.string().optional(),
      sinceDays: z.number().optional().describe('Number of days to look back'),
    }),
    outputSchema: z.array(z.object({
      title: z.string(),
      sourceProvider: z.string(),
      sourceType: z.string(),
      bodyExcerpt: z.string(),
      url: z.string(),
    })),
  },
  async (input, { context }) => {
    const { freelancerId, workspaceId } = context as any;
    const since = input.sinceDays ? new Date(Date.now() - input.sinceDays * 86400000) : undefined;
    const events = await listActivityEvents(freelancerId, workspaceId, {
      provider: input.provider as any,
      sourceType: input.sourceType as any,
      since,
      limit: 50,
    });
    return events.map(e => ({
      title: e.title,
      sourceProvider: e.sourceProvider,
      sourceType: e.sourceType,
      bodyExcerpt: e.bodyExcerpt,
      url: e.url,
    }));
  }
);

const getWorkspaceConnectionsTool = ai.defineTool(
  {
    name: 'getWorkspaceConnections',
    description: 'List all connected apps and their status',
    inputSchema: z.object({}),
    outputSchema: z.array(z.object({
      provider: z.string(),
      label: z.string(),
      status: z.string(),
    })),
  },
  async (_input, { context }) => {
    const { freelancerId, workspaceId } = context as any;
    const conns = await listConnections(freelancerId, workspaceId);
    return conns.map(c => ({ provider: c.provider, label: c.label, status: c.status }));
  }
);

const getRecentBriefingTool = ai.defineTool(
  {
    name: 'getRecentBriefing',
    description: 'Fetch the latest AI briefing for this workspace',
    inputSchema: z.object({}),
    outputSchema: z.object({
      summary: z.string(),
      actionItems: z.array(z.string()),
      blockers: z.array(z.string()),
    }).nullable(),
  },
  async (_input, { context }) => {
    const { freelancerId, workspaceId } = context as any;
    const briefing = await getLatestBriefing(freelancerId, workspaceId);
    if (!briefing) return null;
    return { summary: briefing.summary, actionItems: briefing.actionItems, blockers: briefing.blockers };
  }
);

const listNotesTool = ai.defineTool(
  {
    name: 'listNotes',
    description: 'Read workspace notes',
    inputSchema: z.object({}),
    outputSchema: z.array(z.object({ title: z.string(), content: z.string() })),
  },
  async (_input, { context }) => {
    const { freelancerId, workspaceId } = context as any;
    const notes = await listNotes(freelancerId, workspaceId);
    return notes.map(n => ({ title: n.title, content: n.content }));
  }
);

const listBookmarksTool = ai.defineTool(
  {
    name: 'listBookmarks',
    description: 'Read workspace bookmarks',
    inputSchema: z.object({}),
    outputSchema: z.array(z.object({ title: z.string(), url: z.string(), description: z.string() })),
  },
  async (_input, { context }) => {
    const { freelancerId, workspaceId } = context as any;
    const bookmarks = await listBookmarks(freelancerId, workspaceId);
    return bookmarks.map(b => ({ title: b.title, url: b.url, description: b.description }));
  }
);

export const workspaceChatAgent = ai.defineFlow(
  {
    name: 'workspaceChatAgent',
    inputSchema: WorkspaceChatInputSchema,
    outputSchema: WorkspaceChatOutputSchema,
  },
  async (input: WorkspaceChatInput) => {
    const { workspaceId, freelancerId, messages } = input;

    // Load AI context
    let context = await getAIContext(freelancerId, workspaceId);
    if (!context) {
      context = await generateAIContext(freelancerId, workspaceId);
    }

    const systemPrompt = `You are the Hireverse Workspace Assistant. You help freelancers manage their client workspace.

## Workspace Context
${context}

## Rules
- Never reference or share data from any workspace other than the current one
- Be helpful, concise, and actionable
- Use the available tools to look up real data when answering questions
- If asked about activity, use listActivityEvents
- If asked about connections, use getWorkspaceConnections
- If asked for a summary or briefing, use getRecentBriefing`;

    const chatHistory = messages.map(m => ({
      role: m.role as 'user' | 'model',
      content: [{ text: m.content }],
    }));

    const { text } = await ai.generate({
      system: systemPrompt,
      messages: chatHistory,
      tools: [listActivityEventsTool, getWorkspaceConnectionsTool, getRecentBriefingTool, listNotesTool, listBookmarksTool],
      context: { freelancerId, workspaceId },
    });

    return { responseText: text || 'I apologize, I was unable to generate a response.' };
  }
);
