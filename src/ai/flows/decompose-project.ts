'use server';
/**
 * @fileOverview Decomposes a project brief into a list of actionable microtasks.
 */

import { ai, chooseModelBasedOnPrompt } from '@/ai/ai-instance'; // Import ai instance and model selector
import {
  DecomposeProjectInputSchema,
  type DecomposeProjectInput,
  DecomposeProjectOutputSchema,
  type DecomposeProjectOutput,
  MicrotaskSchema,
  type Microtask,
} from '@/ai/schemas/decompose-project-schema';
import { updateProjectMicrotasks, updateProjectStatus } from '@/services/firestore';
import { Timestamp } from 'firebase/firestore';
import { z } from 'zod';

// Export types separately (though ideally from schema file)
export type { DecomposeProjectInput, DecomposeProjectOutput, Microtask };


// --- Helper: Validate task dependencies ---
// This is a synchronous helper, keep it internal or move to a separate utils file.
function validateTaskDependencies(microtasks: Microtask[]): Microtask[] {
  const taskIdSet = new Set(microtasks.map(task => task.id));

  return microtasks.map(task => {
    const validDependencies = (task.dependencies ?? []).filter(depId => taskIdSet.has(depId));

    if (task.dependencies && validDependencies.length !== task.dependencies.length) {
      console.warn(`Microtask ${task.id} had invalid dependencies. Filtering.`);
    }

    return { ...task, dependencies: validDependencies };
  });
}

// --- Main Decomposition Function ---
export async function decomposeProject(input: DecomposeProjectInput): Promise<DecomposeProjectOutput> {
  // Validate input (optional here, often done by caller/framework)
  DecomposeProjectInputSchema.parse(input);

  await updateProjectStatus(input.projectId, 'decomposing');
  try {
    // Determine model based on brief (uses centralized logic)
    const selectedModel = chooseModelBasedOnPrompt(input.projectBrief); // Use the selector
    console.log(`Decomposing project ${input.projectId} using model: ${selectedModel}`);

    // Define the Genkit prompt
    const decomposePrompt = ai.definePrompt({
       name: 'decomposeProjectPrompt',
       input: { schema: DecomposeProjectInputSchema },
       // Output only the microtasks array, schema validation handles the wrapping object
       output: { schema: z.array(MicrotaskSchema.omit({ status: true, createdAt: true })).min(1).describe('List of microtasks without status/createdAt') }, // Ensure at least one task
       model: selectedModel, // Use the dynamically selected model
       prompt: `You are an expert AI Project Manager. Break this project into clear microtasks.

=== Project Brief ===
{{{projectBrief}}}

=== Required Skills ===
{{{requiredSkills.map(skill => '- ' + skill).join('\\n')}}}

=== Microtask Format ===
{
  "id": "Unique short ID like 'task-001'",
  "description": "Clear task description, min 10 characters",
  "estimatedHours": "Optional, positive number (e.g., 1.5)",
  "requiredSkill": "Optional, must match skills above",
  "dependencies": "Optional array of prerequisite task IDs"
}

Return ONLY a JSON array containing the list of microtasks (at least one). Ensure each microtask has an 'id' and 'description'. Do not wrap it in a {"microtasks": [...]} object.`,
    });


    let output: DecomposeProjectOutput;
    try {
      const { output: rawMicrotasks } = await decomposePrompt(input);

       if (!rawMicrotasks || rawMicrotasks.length === 0) {
           throw new Error(`AI (${selectedModel}) returned no microtasks or invalid structure.`);
       }

       // Validate the raw microtask array against a simplified schema before enriching
       const BasicMicrotaskArraySchema = z.array(MicrotaskSchema.pick({ id: true, description: true }).extend({
            estimatedHours: z.number().min(0.1).optional(),
            requiredSkill: z.string().optional(),
            dependencies: z.array(z.string()).optional(),
        })).min(1);

       const parsedMicrotasks = BasicMicrotaskArraySchema.parse(rawMicrotasks);


       const now = Timestamp.now(); // Create one timestamp instance

       // Map and enrich microtasks *after* basic validation
       const finalMicrotasks: Microtask[] = parsedMicrotasks.map((task, index) => {
         const fallbackId = `task-${String(index + 1).padStart(3, '0')}`;
         return {
           ...task, // Spread the validated basic task data
           id: task.id || fallbackId, // Ensure ID exists
           dependencies: task.dependencies ?? [], // Default to empty array
           status: 'pending', // Default status
           createdAt: now, // Use Timestamp object directly
           // Schema validation ensures description exists
           // Ensure estimatedHours is valid
           estimatedHours: task.estimatedHours && task.estimatedHours > 0 ? task.estimatedHours : undefined,
         };
       });

       // Validate dependencies after IDs and structure are finalized
       const validatedMicrotasks = validateTaskDependencies(finalMicrotasks);
       const finalOutput = { microtasks: validatedMicrotasks };

       // Validate the fully enriched output structure
       output = DecomposeProjectOutputSchema.parse(finalOutput);

    } catch (parseError: any) {
      console.error(`Error parsing or validating AI output for ${input.projectId}:`, parseError?.errors ?? parseError, "Raw:", parseError); // Log raw output if available
      // Consider throwing a more specific error or returning a default error state
      throw new Error(`Invalid AI response structure for decomposition.`);
    }

    // Update Firestore with validated microtasks
    await updateProjectMicrotasks(input.projectId, output.microtasks);
    console.log(`Project ${input.projectId} decomposed into ${output.microtasks.length} microtasks.`);

    return output;

  } catch (error: any) {
    console.error(`Decomposition failed for project ${input.projectId}:`, error);
    // Revert project status on failure
    await updateProjectStatus(input.projectId, 'pending');
    // Return an empty structure consistent with the schema
    return { microtasks: [] };
  }
}
