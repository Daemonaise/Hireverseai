'use server';
/**
 * @fileOverview Decomposes a project brief into a list of actionable microtasks.
 */

import { ai, chooseModelBasedOnPrompt } from '@/ai/ai-instance';
import {
  DecomposeProjectInputSchema,
  type DecomposeProjectInput,
  DecomposeProjectOutputSchema,
  type DecomposeProjectOutput,
  MicrotaskSchema,
  type Microtask as SchemaMicrotask,
} from '@/ai/schemas/decompose-project-schema';
import { updateProjectMicrotasks, updateProjectStatus } from '@/services/firestore';
import { z } from 'zod';
import type { Microtask as ServiceMicrotask } from '@/types/project';

export type { DecomposeProjectInput, DecomposeProjectOutput, SchemaMicrotask as Microtask };

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

// --- Genkit Prompt Definition ---
const decomposePrompt = ai.definePrompt({
  name: 'decomposeProjectPrompt',
  input: { schema: DecomposeProjectInputSchema },
  output: {
    schema: z
      .array(
        MicrotaskSchema.omit({ status: true, createdAt: true })
      )
      .min(1)
      .describe('List of microtasks without status or createdAt'),
  },
  prompt: ({ projectBrief, requiredSkills }) => [
    {
      text:
        `You are an expert AI Project Manager. Break this project into clear microtasks.\n\n` +
        `=== Project Brief ===\n${projectBrief}\n\n` +
        `=== Required Skills ===\n${requiredSkills.map(s => '- ' + s).join('\n')}\n\n` +
        `=== Microtask Format ===\n` +
        `{\n  "id": "Unique short ID like 'task-001'",\n` +
        `  "description": "Clear task description, min 10 characters",\n` +
        `  "estimatedHours": "Optional, positive number (e.g., 1.5)",\n` +
        `  "requiredSkill": "Optional, must match skills above",\n` +
        `  "dependencies": "Optional array of prerequisite task IDs"\n}\n\n` +
        `Return ONLY a JSON array of microtasks.`,
    },
  ],
});

// --- Main Decomposition Function ---
export async function decomposeProject(
  input: DecomposeProjectInput
): Promise<DecomposeProjectOutput> {
  // Validate input
  DecomposeProjectInputSchema.parse(input);

  await updateProjectStatus(input.projectId, 'decomposing');
  try {
    const selectedModel = chooseModelBasedOnPrompt(input.projectBrief);
    console.log(`Decomposing project ${input.projectId} using model ${selectedModel}`);

    // Invoke the prompt with dynamic model
    const { output: rawTasks } = await decomposePrompt(input, { model: selectedModel });
    if (!rawTasks || rawTasks.length === 0) {
      throw new Error('AI returned no microtasks');
    }

    // Basic schema for raw tasks (no status/createdAt)
    const BasicTaskSchema = z.object({
      id: z.string().min(1),
      description: z.string().min(10),
      estimatedHours: z.number().min(0.1).optional(),
      requiredSkill: z.string().optional(),
      dependencies: z.array(z.string()).optional(),
    });

    const parsed = z.array(BasicTaskSchema).min(1).parse(rawTasks);

    // Enrich into schema microtasks
    const timestamp = Date.now();
    const enriched: SchemaMicrotask[] = parsed.map((t, i) => ({
      id: t.id,
      description: t.description,
      estimatedHours: t.estimatedHours,
      requiredSkill: t.requiredSkill,
      dependencies: t.dependencies ?? [],
      status: 'pending',
      createdAt: timestamp,
    }));

    // Validate dependencies
    const validated = validateTaskDependencies(enriched);
    const finalOutput = { microtasks: validated };

    // Full schema validation
    const result = DecomposeProjectOutputSchema.parse(finalOutput);

    // Prepare service tasks (omit createdAt/status, service will set them)
    const serviceTasks: ServiceMicrotask[] = validated.map(t => ({
      id: t.id,
      description: t.description,
      estimatedHours: t.estimatedHours,
      requiredSkill: t.requiredSkill,
      dependencies: t.dependencies,
      // status/createdAt are overwritten by service
    } as ServiceMicrotask));

    // Persist to Firestore
    await updateProjectMicrotasks(input.projectId, serviceTasks);
    console.log(`Persisted ${serviceTasks.length} microtasks`);

    return result;
  } catch (err: any) {
    console.error(`Decompose error for ${input.projectId}:`, err);
    await updateProjectStatus(input.projectId, 'pending');
    return { microtasks: [] };
  }
}
