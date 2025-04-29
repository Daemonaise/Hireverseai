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

// --- Helper: Validate task dependencies ---
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
  await updateProjectStatus(input.projectId, 'decomposing');
  try {
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

Return a JSON object with a single "microtasks" key containing the list of microtasks.`;

    const responseString = await callAI(selectedModel, promptText);

    let output: DecomposeProjectOutput;
    try {
      const cleanedResponse = responseString.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      const parsed = JSON.parse(cleanedResponse);
      output = DecomposeProjectOutputSchema.parse(parsed);

      if (!output.microtasks || output.microtasks.length === 0) {
        throw new Error(`AI (${selectedModel}) returned no microtasks.`);
      }
    } catch (parseError: any) {
      console.error(`Error parsing AI output for ${input.projectId}:`, parseError);
      throw new Error(`Invalid AI response for decomposition.`);
    }

    const now = Timestamp.now(); // 🛠️ Create one timestamp instance

    const finalMicrotasks: Microtask[] = output.microtasks.map((task, index) => {
      const fallbackId = `task-${String(index + 1).padStart(3, '0')}`;
      return {
        id: task.id || fallbackId,
        description: task.description,
        estimatedHours: task.estimatedHours && task.estimatedHours > 0 ? task.estimatedHours : undefined,
        requiredSkill: task.requiredSkill,
        dependencies: task.dependencies ?? [],
        status: 'pending',
        createdAt: now, // 🛠️ CORRECT: Timestamp not number
      };
    });

    const validatedMicrotasks = validateTaskDependencies(finalMicrotasks);
    const finalOutput = { microtasks: validatedMicrotasks };

    await updateProjectMicrotasks(input.projectId, finalOutput.microtasks);
    console.log(`Project ${input.projectId} decomposed into ${finalOutput.microtasks.length} microtasks.`);
    return finalOutput;

  } catch (error: any) {
    console.error(`Decomposition failed for project ${input.projectId}:`, error);
    await updateProjectStatus(input.projectId, 'pending');
    return { microtasks: [] };
  }
}
