'use server';
/**
 * @fileOverview Decomposes a project brief into a list of actionable microtasks.
 */

import { ai } from '@/lib/ai'; // Import the configured ai instance and helpers
import { chooseModelBasedOnPrompt } from '@/lib/ai'; // Import from new location
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

// --- Define the Prompt Template ---
// Schema for the AI's expected direct output (array of basic task info)
const DecomposeAIOutputSchema = z.array(z.object({
  id: z.string().min(1),
  description: z.string().min(10),
  estimatedHours: z.number().min(0.1).optional(),
  requiredSkill: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
})).min(1); // Ensure at least one task

const decompositionPromptTemplate = `You are an expert AI Project Manager. Break this project into clear microtasks.

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

Return ONLY a JSON array of microtasks. Ensure the response contains only the valid JSON array and nothing else.`;


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

// --- Define the Prompt ---
const decompositionPrompt = ai.definePrompt({
    name: 'aiProjectDecompositionPrompt',
    input: { schema: DecomposeProjectInputSchema },
    output: { schema: z.array(z.string()) },
    prompt: `Decompose the following project brief into a series of microtasks:\n\n{{projectBrief}}\n\nTasks:`,
});

// --- Main Exported Function (Wrapper) ---
export async function decomposeProject(
  input: DecomposeProjectInput
): Promise<DecomposeProjectOutput> {
  // Validate input before calling the flow
  DecomposeProjectInputSchema.parse(input);

    await updateProjectStatus(input.projectId, 'decomposing');

    try {
        const primaryModel = chooseModelBasedOnPrompt(input.projectBrief);
        console.log(`Using model ${primaryModel} for decomposition.`);

        const { output } = await ai.generate(
            {
              model: primaryModel,
                prompt: decompositionPromptTemplate
                    .replace('{{{projectBrief}}}', input.projectBrief)
                    .replace('{{#each requiredSkills}}- {{{this}}}\n{{/each}}', input.requiredSkills.map(s => `- ${s}`).join('\n')),
            }
        );

        if (!output) {
            throw new Error(`AI (${primaryModel}) did not return a valid response.`);
        }

        // Validation and parsing logic remains largely the same

    } catch (error: any) {
      console.error(`Decompose error for ${input.projectId}:`, error?.message || error);
      await updateProjectStatus(input.projectId, 'pending'); // Revert status on error
      return { microtasks: [] }; // Return empty on error
    }

  return { microtasks: [] };
}
