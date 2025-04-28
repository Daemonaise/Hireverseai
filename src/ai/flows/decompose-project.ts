
'use server';
/**
 * @fileOverview Decomposes a project brief into a list of actionable microtasks.
 * Uses dynamic model selection based on the project brief.
 *
 * Exports:
 * - decomposeProject - Function to decompose a project into microtasks.
 * - DecomposeProjectInput - Input type.
 * - DecomposeProjectOutput - Output type.
 * - Microtask - Microtask structure type.
 */

// Correctly import from the ai-instance module
import { chooseModelBasedOnPrompt, callAI } from '@/ai/ai-instance';
import { z } from 'zod'; // Use standard zod import
import {
    DecomposeProjectInputSchema,
    type DecomposeProjectInput,
    DecomposeProjectOutputSchema,
    type DecomposeProjectOutput,
    MicrotaskSchema,
    type Microtask,
} from '@/ai/schemas/decompose-project-schema';
import { updateProjectMicrotasks, updateProjectStatus } from '@/services/firestore';
// Removed ProjectStatus import as it's not directly used here after refactor

// Export types
export type { DecomposeProjectInput, DecomposeProjectOutput, Microtask };

/**
 * Decomposes a project brief into microtasks using an AI model and updates the project in Firestore.
 * @param input - The project details (ID, brief, skills).
 * @returns The generated list of microtasks.
 */
export async function decomposeProject(input: DecomposeProjectInput): Promise<DecomposeProjectOutput> {
     await updateProjectStatus(input.projectId, 'decomposing');
     try {
        // 1. Choose model
        // Correctly use the imported function
        const selectedModel = chooseModelBasedOnPrompt(input.projectBrief);
        console.log(`Decomposing project ${input.projectId} using model: ${selectedModel}`);

        // 2. Construct prompt
        // Create a string representation of the Microtask schema for the prompt
        // This is a simplified representation; a more robust method might involve generating a description from Zod
        const microtaskSchemaDescription = `
{
  "id": "Unique string ID (e.g., 'task-001')",
  "description": "Clear, concise task description (min 10 chars)",
  "estimatedHours": "Optional positive number (e.g., 2.5, must be > 0)",
  "requiredSkill": "Optional skill from list: [${input.requiredSkills.join(', ')}]",
  "dependencies": "Optional array of prerequisite task IDs (e.g., ['task-001'])"
}`;

        const promptText = `You are an expert AI Project Manager specializing in breaking down complex project briefs into a series of clear, actionable, and sequential microtasks.

Project Brief:
${input.projectBrief}

Required Skills:
${input.requiredSkills.map(s => `- ${s}`).join('\n')}

Decompose the project brief into a list of microtasks. Each microtask should fit the schema described below.
Focus on creating tasks that can be completed independently by a freelancer possessing the required skill. Aim for tasks roughly 1-4 hours in estimated duration.
Ensure generated task IDs are unique within this project.
Ensure 'estimatedHours', if provided, is a positive number greater than 0.

Output MUST strictly be a JSON object with a single key "microtasks" containing an array of microtask objects conforming to this structure:
${microtaskSchemaDescription}

Example Output:
{
  "microtasks": [
    { "id": "task-001", "description": "...", "estimatedHours": 3, "requiredSkill": "...", "dependencies": [] },
    { "id": "task-002", "description": "...", "dependencies": ["task-001"] }
  ]
}
Do not include any introductory text or explanations outside the main JSON object.`;

        // 3. Call AI using the unified function
        const responseString = await callAI(selectedModel, promptText);

        // 4. Parse and validate response
        let output: DecomposeProjectOutput;
        try {
          // Clean potential markdown code block fences
          const cleanedResponse = responseString.replace(/^```json\n?/, '').replace(/\n?```$/, '');
          const parsed = JSON.parse(cleanedResponse);
          output = DecomposeProjectOutputSchema.parse(parsed); // Validate against Zod schema

          if (!output || !output.microtasks || output.microtasks.length === 0) {
            console.error(`AI (${selectedModel}) returned valid JSON but no microtasks for project ${input.projectId}:`, output);
            throw new Error(`AI (${selectedModel}) failed to decompose project ${input.projectId}. No microtasks were generated.`);
          }

        } catch (parseError: any) {
          console.error(`Error parsing/validating AI response for project ${input.projectId} using ${selectedModel}:`, parseError.errors ?? parseError, "Raw Response:", responseString);
          throw new Error(`AI (${selectedModel}) returned an invalid response structure.`);
        }

        // 5. Post-process and validate microtasks (IDs, hours, dependencies)
        const taskIds = new Set();
        const validatedMicrotasks: Microtask[] = [];
        output.microtasks.forEach((task, index) => {
             let currentTask = {...task};
             // Fallback ID generation/validation
             if (!currentTask.id || typeof currentTask.id !== 'string' || currentTask.id.length === 0 || taskIds.has(currentTask.id)) {
                console.warn(`Duplicate or missing/invalid ID found for task at index ${index}. Assigning fallback ID: task-${String(index + 1).padStart(3, '0')}`);
                currentTask.id = `task-${String(index + 1).padStart(3, '0')}`;
                // Ensure the fallback ID doesn't collide either (very unlikely with padded index)
                while (taskIds.has(currentTask.id)) {
                    currentTask.id = `task-${String(index + 1).padStart(3, '0')}-${Math.random().toString(36).substring(7)}`;
                }
             }
             taskIds.add(currentTask.id);

             // Validate dependencies exist in the current list
             if (currentTask.dependencies) {
                 currentTask.dependencies = currentTask.dependencies.filter(depId => output.microtasks.some(t => t.id === depId));
             }

             // Validate estimatedHours
             if (currentTask.estimatedHours !== undefined && (typeof currentTask.estimatedHours !== 'number' || currentTask.estimatedHours <= 0)) {
                console.warn(`Invalid estimatedHours (${currentTask.estimatedHours}) for task ${currentTask.id}. Setting to undefined.`);
                currentTask.estimatedHours = undefined;
             }
             validatedMicrotasks.push(currentTask);
        });

        const validatedOutput = { microtasks: validatedMicrotasks };

        // 6. Update Firestore
        await updateProjectMicrotasks(input.projectId, validatedOutput.microtasks);
        console.log(`Project ${input.projectId} successfully decomposed into ${validatedOutput.microtasks.length} microtasks using ${selectedModel}.`);
        return validatedOutput;

     } catch (error: any) {
         console.error(`Error during decomposition or update for project ${input.projectId}:`, error);
         await updateProjectStatus(input.projectId, 'pending'); // Revert status on failure
         // Ensure a DecomposeProjectOutput is returned even on error
         return { microtasks: [] };
     }
}
