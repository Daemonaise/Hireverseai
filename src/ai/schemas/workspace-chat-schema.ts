import { z } from 'zod';

export const WorkspaceChatInputSchema = z.object({
  workspaceId: z.string(),
  freelancerId: z.string(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })),
});

export const WorkspaceChatOutputSchema = z.object({
  responseText: z.string(),
});

export type WorkspaceChatInput = z.infer<typeof WorkspaceChatInputSchema>;
export type WorkspaceChatOutput = z.infer<typeof WorkspaceChatOutputSchema>;
