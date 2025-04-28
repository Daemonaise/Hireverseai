'use server';
/**
 * @fileOverview Decomposes a project brief into a list of actionable microtasks.
 * Uses dynamic model selection based on the project brief.
 *
 * Exports:
 * - decomposeProject - Function to decompose a project into microtasks.
 */

import { ai, chooseModelBasedOnPrompt } from '@/ai/ai-instance'; // Import chooseModelBasedOnPrompt
import { z } from 'genkit';
import {
    DecomposeProjectInputSchema, // Import schema definition
    type DecomposeProjectInput, // Export type only
    DecomposeProjectOutputSchema, // Import schema definition
    type DecomposeProjectOutput, // Export type only
    MicrotaskSchema, // Import schema definition
    type Microtask, // Export type only
} from '@/ai/schemas/decompose-project-schema';
import { updateProjectMicrotasks, updateProjectStatus } from '@/services/firestore';
import type { ProjectStatus } from '@/types/project';

// Define the prompt structure generator function
// Keep internal, do not export
const createDecompositionPrompt = (modelName: string) => ai.definePrompt({
    name: `projectDecompositionPrompt_${modelName.replace(/[^a-zA-Z0-9]/g, '_')}`, // Dynamic name
    input: { schema: DecomposeProjectInputSchema },
    output: { schema: DecomposeProjectOutputSchema },
    model: modelName, // Use the dynamically selected model
    prompt: `You are an expert AI Project Manager specializing in breaking down complex project briefs into a series of clear, actionable, and sequential microtasks.

Project Brief:
{{{projectBrief}}}

Required Skills:
{{#each requiredSkills}} - {{this}} {{/each}}

Decompose the project brief into a list of microtasks. Each microtask should:
1.  Have a unique ID (e.g., "task-001", "task-002").
2.  Have a clear and concise description of the work to be done.
3.  Optionally, estimate the hours required (if possible from the brief, must be > 0).
4.  Optionally, identify the primary skill required (from the provided list).
5.  Optionally, list the IDs of any prerequisite microtasks (dependencies). Ensure tasks are logically ordered.

Focus on creating tasks that can be completed independently by a freelancer possessing the required skill. Aim for tasks roughly 1-4 hours in estimated duration.

Output MUST strictly follow the provided Microtask schema structure within the 'microtasks' array.
Ensure the generated IDs are unique within this project.
Ensure 'estimatedHours', if provided, is a positive number greater than 0.
`,
    config: {
        temperature: 0.5,
    },
});

// Export only the async wrapper function and types
export type { DecomposeProjectInput, DecomposeProjectOutput, Microtask };

/**
 * Decomposes a project brief into microtasks using an AI model and updates the project in Firestore.
 * @param input - The project details (ID, brief, skills).
 * @returns The generated list of microtasks.
 */
export async function decomposeProject(input: DecomposeProjectInput): Promise<DecomposeProjectOutput> {
     await updateProjectStatus(input.projectId, 'decomposing');
     try {
        const result = await decomposeProjectFlow(input);
        await updateProjectMicrotasks(input.projectId, result.microtasks);
        console.log(`Project ${input.projectId} successfully decomposed into ${result.microtasks.length} microtasks.`);
        return result;
     } catch (error: any) {
         console.error(`Error during decomposition or update for project ${input.projectId}:`, error);
         if (error.message?.includes('API key')) {
             console.error(`Ensure your GOOGLE_API_KEY (or other configured keys) is valid and has permissions.`);
         } else if (error.message?.includes('INVALID_ARGUMENT')) {
             console.error(`Invalid argument error during decomposition for project ${input.projectId}. Check prompt/schema. Error:`, error.details);
         }
         await updateProjectStatus(input.projectId, 'pending'); // Revert status on failure
         return { microtasks: [] }; // Return empty array on error
     }
}

// Keep internal, do not export
const decomposeProjectFlow = ai.defineFlow<
  typeof DecomposeProjectInputSchema,
  typeof DecomposeProjectOutputSchema
>(
  {
    name: 'decomposeProjectFlow',
    inputSchema: DecomposeProjectInputSchema,
    outputSchema: DecomposeProjectOutputSchema,
  },
  async (input) => {
    // Choose model based on the project brief content - Await the async function
    const selectedModel = await chooseModelBasedOnPrompt(input.projectBrief);
    console.log(`Decomposing project ${input.projectId} using model: ${selectedModel}`);

    try {
        // Create the specific prompt definition for this brief and model
        const decompositionPrompt = createDecompositionPrompt(selectedModel);

        // Call the dynamically created prompt definition
        const { output } = await decompositionPrompt(input);

        if (!output || !output.microtasks || output.microtasks.length === 0) {
             console.error(`Failed to generate valid microtask output for project ${input.projectId} using ${selectedModel}:`, output);
             throw new Error(`AI (${selectedModel}) failed to decompose project ${input.projectId}. No microtasks were generated.`);
        }

        // Validation logic remains the same
        const taskIds = new Set();
        const validatedMicrotasks: Microtask[] = [];
        output.microtasks.forEach((task, index) => {
             let currentTask = {...task};
             if (!currentTask.id || taskIds.has(currentTask.id)) {
                console.warn(`Duplicate or missing ID found for task at index ${index}. Assigning fallback ID.`);
                currentTask.id = `task-${String(index + 1).padStart(3, '0')}`;
             }
             taskIds.add(currentTask.id);
             if (currentTask.dependencies) {
                 currentTask.dependencies = currentTask.dependencies.filter(depId => taskIds.has(depId));
             }
             if (currentTask.estimatedHours !== undefined && currentTask.estimatedHours <= 0) {
                console.warn(`Invalid estimatedHours (${currentTask.estimatedHours}) for task ${currentTask.id}. Setting to undefined.`);
                currentTask.estimatedHours = undefined;
             }
             validatedMicrotasks.push(currentTask);
        });

        const validatedOutput = { microtasks: validatedMicrotasks };
        console.log(`Generated ${validatedOutput.microtasks.length} microtasks for project ${input.projectId} using ${selectedModel}`);
        return validatedOutput;

    } catch (error: any) {
         console.error(`Error in decomposeProjectFlow for project ${input.projectId} using ${selectedModel}:`, error);
         if (error.message?.includes('API key')) {
             console.error(`Ensure your GOOGLE_API_KEY (or other configured keys) is valid and has permissions.`);
         } else if (error.message?.includes('INVALID_ARGUMENT')) {
             console.error(`Invalid argument error during decomposition flow for project ${input.projectId} using ${selectedModel}. Check prompt/schema. Error:`, error.details);
         }
         const errorMessage = error instanceof Error ? error.message : String(error);
         throw new Error(`Error decomposing project ${input.projectId} with ${selectedModel}: ${errorMessage}`);
    }
  }
);
