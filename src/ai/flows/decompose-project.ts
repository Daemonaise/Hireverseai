'use server';
/**
 * @fileOverview Decomposes a project brief into a list of actionable microtasks.
 */

import { callAI } from '@/ai/ai-instance';
import { chooseModelBasedOnPrompt } from '@/lib/model-selector';
import {
  DecomposeProjectInputSchema,
  type DecomposeProjectInput,
  DecomposeProjectOutputSchema,
  type DecomposeProjectOutput,
  MicrotaskSchema,
  type Microtask,
} from '@/ai/schemas/decompose-project-schema';
import { updateProjectMicrotasks, updateProjectStatus } from '@/services/firestore';
import { Timestamp } from 'firebase/firestore'; // ← NEEDED to create correct Timestamp type

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
  // DecomposeProjectInputSchema.parse(input);

  await updateProjectStatus(input.projectId, 'decomposing');
  try {
    // Determine model based on brief (uses centralized logic)
    const selectedModel = chooseModelBasedOnPrompt(input.projectBrief);
    console.log(`Decomposing project ${input.projectId} using model: ${selectedModel}`);

    const promptText = `You are an expert AI Project Manager. Break this project into clear microtasks.

=== Project Brief ===
${input.projectBrief}

=== Required Skills ===
${input.requiredSkills.map(skill => `- ${skill}`).join('\n')}

=== Microtask Format ===
{
  "id": "Unique short ID like 'task-001'",
  "description": "Clear task description, min 10 characters",
  "estimatedHours": "Optional, positive number",
  "requiredSkill": "Optional, must match skills above",
  "dependencies": "Optional array of prerequisite task IDs"
}

Return ONLY a JSON object with a single "microtasks" key containing the list of microtasks. Ensure each microtask has an 'id' and 'description'.`;

    // Use the centralized callAI function
    const responseString = await callAI('auto', promptText);

    let output: DecomposeProjectOutput;
    try {
      const cleanedResponse = responseString.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      const parsed = JSON.parse(cleanedResponse);

      // Validate the parsed JSON against the expected output schema
      output = DecomposeProjectOutputSchema.parse(parsed);

      // Additional check for empty microtasks array
      if (!output.microtasks || output.microtasks.length === 0) {
        throw new Error(`AI (${selectedModel}) returned no microtasks or invalid structure.`);
      }
    } catch (parseError: any) {
      console.error(`Error parsing AI output for ${input.projectId}:`, parseError?.errors ?? parseError, "Raw:", responseString);
      // Consider throwing a more specific error or returning a default error state
      throw new Error(`Invalid AI response structure for decomposition.`);
    }

    const now = Timestamp.now(); // Create one timestamp instance

    // Map and enrich microtasks before validation
    const finalMicrotasks: Microtask[] = output.microtasks.map((task, index) => {
      const fallbackId = `task-${String(index + 1).padStart(3, '0')}`;
      return {
        id: task.id || fallbackId, // Ensure ID exists
        description: task.description, // Schema ensures description exists
        estimatedHours: task.estimatedHours && task.estimatedHours > 0 ? task.estimatedHours : undefined,
        requiredSkill: task.requiredSkill, // Optional
        dependencies: task.dependencies ?? [], // Default to empty array
        status: 'pending', // Default status
        createdAt: now, // Set creation timestamp
      };
    });

    // Validate dependencies after IDs and structure are finalized
    const validatedMicrotasks = validateTaskDependencies(finalMicrotasks);
    const finalOutput = { microtasks: validatedMicrotasks };

    // Update Firestore with validated microtasks
    await updateProjectMicrotasks(input.projectId, finalOutput.microtasks);
    console.log(`Project ${input.projectId} decomposed into ${finalOutput.microtasks.length} microtasks.`);

    // Validate final output before returning (optional)
    // DecomposeProjectOutputSchema.parse(finalOutput);

    return finalOutput;

  } catch (error: any) {
    console.error(`Decomposition failed for project ${input.projectId}:`, error);
    // Revert project status on failure
    await updateProjectStatus(input.projectId, 'pending');
    // Return an empty structure consistent with the schema
    return { microtasks: [] };
  }
}
