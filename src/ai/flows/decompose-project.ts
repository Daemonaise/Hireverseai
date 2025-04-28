
'use server';
/**
 * @fileOverview Decomposes a project brief into a list of actionable microtasks.
 * Uses the default Google AI model.
 *
 * Exports:
 * - decomposeProject - Function to decompose a project into microtasks.
 */

import { ai } from '@/ai/ai-instance'; // Import the configured 'ai' instance
import { z } from 'genkit';
import {
    DecomposeProjectInputSchema,
    type DecomposeProjectInput,
    DecomposeProjectOutputSchema,
    type Microtask, // Import Microtask type for internal use
    MicrotaskSchema, // Import MicrotaskSchema for prompt definition
} from '@/ai/schemas/decompose-project-schema';
import { updateProjectMicrotasks, updateProjectStatus } from '@/services/firestore'; // Import Firestore service
import type { ProjectStatus } from '@/types/project'; // Import ProjectStatus type


// Define the prompt structure outside the flow, using the imported MicrotaskSchema
// Modify the estimatedHours within the prompt's expected output schema
const decompositionPromptDefinition = ai.definePrompt({
    name: `projectDecompositionPrompt`, // Generic name
    input: { schema: DecomposeProjectInputSchema },
    // Use the imported schema but override estimatedHours constraint
    output: { schema: DecomposeProjectOutputSchema }, // Using the direct schema which now has .min(0.1)
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
        temperature: 0.5, // Moderate temperature for structured but slightly flexible decomposition
    },
     // Model defaults to the one configured in ai-instance.ts (gemini-2.0-flash)
});


/**
 * Decomposes a project brief into microtasks using an AI model and updates the project in Firestore.
 * @param input - The project details (ID, brief, skills).
 * @returns The generated list of microtasks.
 */
export async function decomposeProject(input: DecomposeProjectInput): Promise<z.infer<typeof DecomposeProjectOutputSchema>> {
     // Update project status to 'decomposing' before starting
     await updateProjectStatus(input.projectId, 'decomposing');
     try {
        const result = await decomposeProjectFlow(input);
        // Update project in Firestore with the decomposed microtasks and set status to 'decomposed'
        await updateProjectMicrotasks(input.projectId, result.microtasks);
        // Note: Status is updated within updateProjectMicrotasks now
        // await updateProjectStatus(input.projectId, 'decomposed');
        console.log(`Project ${input.projectId} successfully decomposed into ${result.microtasks.length} microtasks.`);
        return result;
     } catch (error: any) {
         console.error(`Error during decomposition or update for project ${input.projectId}:`, error);
         if (error.message?.includes('API key')) {
             console.error(`Ensure your GOOGLE_API_KEY is valid and has permissions.`);
         }
         // Optionally revert status back to 'pending' or set an 'error' status
         await updateProjectStatus(input.projectId, 'pending'); // Revert status on failure
         // Return a valid empty structure instead of throwing to avoid breaking caller if needed
         // throw error; // Re-throw the error to be handled by the caller
          return { microtasks: [] }; // Return empty array on error
     }
}


// Define the internal Genkit flow
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
    console.log(`Decomposing project ${input.projectId} using default model`);

    try {
        // Call the prompt definition using the default model
        const { output } = await decompositionPromptDefinition(
            input
            // No model override needed
        );

        if (!output || !output.microtasks || output.microtasks.length === 0) {
             console.error(`Failed to generate valid microtask output for project ${input.projectId}:`, output);
             // Throw specific error that can be caught by the wrapper function
             throw new Error(`AI failed to decompose project ${input.projectId}. No microtasks were generated.`);
        }

        // Basic validation (e.g., ensure IDs are unique, hours are valid) - can be enhanced
        const taskIds = new Set();
        const validatedMicrotasks: Microtask[] = [];
        output.microtasks.forEach((task, index) => {
             let currentTask = {...task}; // Clone task to modify if needed

             if (!currentTask.id || taskIds.has(currentTask.id)) {
                console.warn(`Duplicate or missing ID found for task at index ${index}. Assigning fallback ID.`);
                currentTask.id = `task-${String(index + 1).padStart(3, '0')}`; // Assign a fallback ID
             }
             taskIds.add(currentTask.id);

             // Ensure dependencies exist within the generated list
             if (currentTask.dependencies) {
                 currentTask.dependencies = currentTask.dependencies.filter(depId => taskIds.has(depId));
             }

              // Validate estimatedHours (ensure it's > 0 if present)
             if (currentTask.estimatedHours !== undefined && currentTask.estimatedHours <= 0) {
                console.warn(`Invalid estimatedHours (${currentTask.estimatedHours}) for task ${currentTask.id}. Setting to undefined.`);
                currentTask.estimatedHours = undefined; // Remove invalid estimate
             }

             validatedMicrotasks.push(currentTask);
        });

        // Return the validated microtasks
        const validatedOutput = { microtasks: validatedMicrotasks };

        console.log(`Generated ${validatedOutput.microtasks.length} microtasks for project ${input.projectId}`);
        return validatedOutput;

    } catch (error: any) {
         console.error(`Error in decomposeProjectFlow for project ${input.projectId}:`, error);
          if (error.message?.includes('API key')) {
             console.error(`Ensure your GOOGLE_API_KEY is valid and has permissions.`);
         }
         const errorMessage = error instanceof Error ? error.message : String(error);
          // Re-throw to be caught by the wrapper
         throw new Error(`Error decomposing project ${input.projectId}: ${errorMessage}`);
    }
  }
);
