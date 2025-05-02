'use server';
/**
 * @fileOverview Decomposes a project brief into a list of actionable microtasks.
 */

import { callAI } from '@/ai/ai-instance'; // Import the centralized callAI function
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

// --- Genkit Prompt Definition REMOVED ---
// The logic is moved into the promptText for callAI

// --- Main Decomposition Function ---
export async function decomposeProject(
  input: DecomposeProjectInput
): Promise<DecomposeProjectOutput> {
  // Validate input
  DecomposeProjectInputSchema.parse(input);

  await updateProjectStatus(input.projectId, 'decomposing');
  try {
    console.log(`Decomposing project ${input.projectId}...`);

    // Construct the prompt for the callAI function
    const promptText = `You are an expert AI Project Manager. Break this project into clear microtasks.

=== Project Brief ===
${input.projectBrief}

=== Required Skills ===
${input.requiredSkills.map(s => '- ' + s).join('\n')}

=== Microtask Format ===
{
  "id": "Unique short ID like 'task-001'",
  "description": "Clear task description, min 10 characters",
  "estimatedHours": "Optional, positive number (e.g., 1.5)",
  "requiredSkill": "Optional, must match skills above",
  "dependencies": "Optional array of prerequisite task IDs"
}

Return ONLY a JSON array of microtasks. Ensure the response contains only the valid JSON array and nothing else.`;


    // Invoke the centralized AI function
    const responseText = await callAI(promptText);

    // Attempt to parse the JSON response
    let rawTasks: any[]; // Define rawTasks here
    try {
       // Basic JSON extraction (might need refinement)
       const jsonMatch = responseText.match(/\[[\s\S]*\]/); // Look for an array structure
       if (!jsonMatch) throw new Error("No JSON array found in response.");
       rawTasks = JSON.parse(jsonMatch[0]);

        // Basic schema validation for raw tasks (no status/createdAt)
       const BasicTaskSchema = z.array(z.object({
         id: z.string().min(1),
         description: z.string().min(10),
         estimatedHours: z.number().min(0.1).optional(),
         requiredSkill: z.string().optional(),
         dependencies: z.array(z.string()).optional(),
       })).min(1); // Ensure at least one task

       const parsed = BasicTaskSchema.parse(rawTasks); // Validate the parsed structure
       rawTasks = parsed; // Use validated data


    } catch (parseError: any) {
        console.error(`Error parsing decomposition JSON for project ${input.projectId}:`, parseError.message, "Raw Response:", responseText);
        throw new Error('AI did not return a valid JSON array of microtasks.');
    }

    if (!rawTasks || rawTasks.length === 0) {
      throw new Error('AI returned no microtasks after parsing.');
    }


    // Enrich into schema microtasks
    const timestamp = Date.now();
    const enriched: SchemaMicrotask[] = rawTasks.map((t, i) => ({
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
    console.log(`Persisted ${serviceTasks.length} microtasks for project ${input.projectId}`);

    return result;
  } catch (err: any) {
    console.error(`Decompose error for ${input.projectId}:`, err?.message || err);
    await updateProjectStatus(input.projectId, 'pending'); // Revert status on error
    return { microtasks: [] }; // Return empty on error
  }
}
    
