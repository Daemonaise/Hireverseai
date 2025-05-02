'use server';
/**
 * @fileOverview Decomposes a project brief into a list of actionable microtasks.
 */

import { ai } from '@/ai/ai-instance'; // Import the configured ai instance
import {
  DecomposeProjectInputSchema,
  type DecomposeProjectInput,
  DecomposeProjectOutputSchema,
  type DecomposeProjectOutput,
  MicrotaskSchema, // Schema for individual microtask (used in output)
  type Microtask as SchemaMicrotask,
} from '@/ai/schemas/decompose-project-schema';
import { updateProjectMicrotasks, updateProjectStatus } from '@/services/firestore';
import { z } from 'zod';
import type { Microtask as ServiceMicrotask } from '@/types/project';
import { Timestamp } from 'firebase/firestore';

export type { DecomposeProjectInput, DecomposeProjectOutput, SchemaMicrotask as Microtask };

// --- Define the Prompt ---
// Schema for the AI's expected direct output (array of basic task info)
const DecomposeAIOutputSchema = z.array(z.object({
  id: z.string().min(1),
  description: z.string().min(10),
  estimatedHours: z.number().min(0.1).optional(),
  requiredSkill: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
})).min(1); // Ensure at least one task

const decompositionPrompt = ai.definePrompt({
  name: 'decompositionPrompt',
  input: { schema: DecomposeProjectInputSchema },
  output: { schema: DecomposeAIOutputSchema }, // AI outputs the basic task array
  // model: 'googleai/gemini-1.5-flash', // Example: Specify model if needed
  prompt: `You are an expert AI Project Manager. Break this project into clear microtasks.

=== Project Brief ===
{{{projectBrief}}}

=== Required Skills ===
{{#each requiredSkills}}- {{{this}}}
{{/each}}

=== Microtask Format ===
{
  "id": "Unique short ID like 'task-001'",
  "description": "Clear task description, min 10 characters",
  "estimatedHours": "Optional, positive number (e.g., 1.5)",
  "requiredSkill": "Optional, must match skills above",
  "dependencies": "Optional array of prerequisite task IDs"
}

Return ONLY a JSON array of microtasks. Ensure the response contains only the valid JSON array and nothing else.`,
});

// --- Helper: Validate task dependencies ---
function validateTaskDependencies(tasks: SchemaMicrotask[]): SchemaMicrotask[] {
  const ids = new Set(tasks.map(t => t.id));
  return tasks.map(task => ({
    ...task,
    dependencies: (task.dependencies ?? []).filter(dep => {
      if (!ids.has(dep)) console.warn(`Invalid dependency ${dep} for task ${task.id}`);
      return ids.has(dep);
    }),
  }));
}

// --- Define the Flow ---
const decomposeProjectFlow = ai.defineFlow<
  typeof DecomposeProjectInputSchema,
  typeof DecomposeProjectOutputSchema
>(
  {
    name: 'decomposeProjectFlow',
    inputSchema: DecomposeProjectInputSchema,
    outputSchema: DecomposeProjectOutputSchema, // Flow outputs the final enriched tasks
  },
  async (input) => {
    await updateProjectStatus(input.projectId, 'decomposing');
    let rawTasks: z.infer<typeof DecomposeAIOutputSchema>;

    try {
      console.log(`Decomposing project ${input.projectId}...`);

      // Invoke the defined prompt
      const { output } = await decompositionPrompt(input);

      if (!output) {
        throw new Error('AI did not return a valid JSON array of microtasks.');
      }

      // Validate the AI's direct output structure
      const validationResult = DecomposeAIOutputSchema.safeParse(output);
        if (!validationResult.success) {
          // Provide detailed validation errors
          const errorDetails = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
          throw new Error(`Invalid task structure received from AI: ${errorDetails}`);
        }
      rawTasks = validationResult.data;

      if (!rawTasks || rawTasks.length === 0) {
        throw new Error('AI returned no microtasks after parsing.');
      }

      // Enrich into schema microtasks (add status, createdAt)
      const timestamp = Timestamp.now(); // Use Firestore Timestamp
      const enriched: SchemaMicrotask[] = rawTasks.map((t) => ({
        id: t.id,
        description: t.description,
        estimatedHours: t.estimatedHours,
        requiredSkill: t.requiredSkill,
        dependencies: t.dependencies ?? [],
        status: 'pending', // Default status
        createdAt: timestamp, // Set creation timestamp
      }));

      // Validate dependencies
      const validated = validateTaskDependencies(enriched);
      const finalOutput = { microtasks: validated };

      // Full schema validation for the flow's final output
      DecomposeProjectOutputSchema.parse(finalOutput);

      // Prepare service tasks (match the type expected by the service)
      const serviceTasks: ServiceMicrotask[] = validated.map(t => ({
        id: t.id,
        description: t.description,
        estimatedHours: t.estimatedHours,
        requiredSkill: t.requiredSkill,
        dependencies: t.dependencies,
        status: 'pending', // Ensure status matches service type if needed
        // createdAt might be set by service or taken from 't.createdAt'
      } as ServiceMicrotask));

      // Persist to Firestore
      await updateProjectMicrotasks(input.projectId, serviceTasks);
      console.log(`Persisted ${serviceTasks.length} microtasks for project ${input.projectId}`);

      return finalOutput;

    } catch (err: any) {
      console.error(`Decompose error for ${input.projectId}:`, err?.message || err);
      await updateProjectStatus(input.projectId, 'pending'); // Revert status on error
      return { microtasks: [] }; // Return empty on error
    }
  }
);

// --- Main Exported Function (Wrapper) ---
export async function decomposeProject(
  input: DecomposeProjectInput
): Promise<DecomposeProjectOutput> {
  // Validate input before calling the flow
  DecomposeProjectInputSchema.parse(input);
  return decomposeProjectFlow(input);
}
