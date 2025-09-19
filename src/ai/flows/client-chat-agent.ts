'use server';
/**
 * @fileOverview A conversational AI agent for clients to manage their projects.
 * Exports:
 * - chatWithClientAgent (async function)
 * - ClientChatHistory (type)
 */

import { ai } from '@/lib/ai';
import { z } from 'zod';
import { getProjectsByClientId, getProjectById } from '@/services/firestore';
import { matchFreelancer } from '@/ai/flows/match-freelancer';
import { type Message } from 'ai';

// --- Tool Definitions ---

const listClientProjectsTool = ai.defineTool(
  {
    name: 'listClientProjects',
    description: 'Lists all projects for the current client, showing their ID, name, status, and assigned freelancer.',
    inputSchema: z.object({ clientId: z.string().describe("The client's unique ID.") }),
    outputSchema: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        status: z.string(),
        assignedFreelancerId: z.string().optional(),
      })
    ),
  },
  async ({ clientId }) => {
    console.log(`[Agent Tool] Listing projects for client: ${clientId}`);
    const projects = await getProjectsByClientId(clientId);
    return projects.map(({ id, name, status, assignedFreelancerId }) => ({
      id: id || 'N/A',
      name,
      status,
      assignedFreelancerId,
    }));
  }
);

const getProjectDetailsTool = ai.defineTool(
  {
    name: 'getProjectDetails',
    description: 'Retrieves detailed information about a specific project by its ID.',
    inputSchema: z.object({ projectId: z.string().describe("The project's unique ID.") }),
    outputSchema: z.object({
        id: z.string(),
        name: z.string(),
        brief: z.string(),
        status: z.string(),
        paymentStatus: z.string(),
        assignedFreelancerId: z.string().optional(),
        estimatedDeliveryDate: z.string().optional(),
        progress: z.number().optional(),
    }).nullable(),
  },
  async ({ projectId }) => {
    console.log(`[Agent Tool] Getting details for project: ${projectId}`);
    const project = await getProjectById(projectId);
    if (!project) return null;
    return {
        id: project.id || 'N/A',
        name: project.name,
        brief: project.brief,
        status: project.status,
        paymentStatus: project.paymentStatus,
        assignedFreelancerId: project.assignedFreelancerId,
        estimatedDeliveryDate: project.estimatedDeliveryDate?.toDate().toISOString(),
        progress: project.progress,
    };
  }
);

const initiateNewProjectTool = ai.defineTool(
    {
        name: 'initiateNewProject',
        description: 'Starts a new project by providing a project brief. This will trigger the freelancer matching and estimation process.',
        inputSchema: z.object({
            projectBrief: z.string().min(20).describe('A detailed description of the project requirements.'),
        }),
        outputSchema: z.object({
            reasoning: z.string(),
            estimatedTimeline: z.string().optional(),
            totalCostToClient: z.number().nonnegative().optional(),
            status: z.string(),
        }),
    },
    async ({ projectBrief }) => {
        console.log('[Agent Tool] Initiating new project with brief:', projectBrief);
        // Note: The `matchFreelancer` flow requires a `freelancerId` which is the client ID in this context.
        // This is a slight mismatch in naming but we'll adapt. This ID isn't used by the flow currently.
        const result = await matchFreelancer({ projectBrief, freelancerId: 'client-from-agent' });
        return {
            reasoning: result.reasoning,
            estimatedTimeline: result.estimatedTimeline,
            totalCostToClient: result.totalCostToClient,
            status: result.status,
        };
    }
);


// --- Main Agent Prompt ---
const clientAgentSystemPrompt = `You are a helpful AI assistant for Hireverse clients.
- Your name is "Hireverse Agent".
- Be conversational, friendly, and concise.
- Use the available tools to answer questions about projects or to create new ones.
- When listing projects, present them clearly.
- If the user wants to start a new project, confirm the brief with them and then use the 'initiateNewProject' tool.
- If you don't have enough information, ask clarifying questions.
- The user's ID is {{clientId}}. You must pass this ID to any tool that requires it.
`;

export const clientAgent = ai.definePrompt({
    name: 'clientAgent',
    system: clientAgentSystemPrompt,
    tools: [listClientProjectsTool, getProjectDetailsTool, initiateNewProjectTool],
});


// --- Exported Flow ---

export type ClientChatHistory = Message[];

export async function chatWithClientAgent(clientId: string, history: ClientChatHistory): Promise<string> {
  console.log(`[Client Agent] Processing chat for client ${clientId}...`);
  try {
    const { output } = await clientAgent({
        prompt: history, // Pass the entire history
        context: { clientId }, // Provide clientId in the context for the prompt template
    });

    if (!output?.content) {
      throw new Error("AI agent did not return a valid response.");
    }
    
    // The output from a tool-using prompt is a structured object, we need the text part.
    const textResponse = output.content.find(part => part.text)?.text;

    if (!textResponse) {
        // This can happen if the AI only decided to call a tool but not say anything.
        // In a more advanced setup, we would loop until a text response is generated.
        // For now, we'll return a simple message.
        return "I've processed that request. What's next?";
    }

    return textResponse;
  } catch (error) {
    console.error('[Client Agent] Error in chat flow:', error);
    return `Sorry, I encountered an error. Please try again. (Details: ${ (error as Error).message })`;
  }
}
