'use server';
/**
 * @fileOverview Decomposes a project brief into a list of actionable microtasks.
 */

import { ai } from '@/lib/ai'; // Import the configured ai instance
import { chooseModelBasedOnPrompt } from '@/lib/ai-server-helpers'; // Import from correct location
import { validateAIOutput } from '@/ai/validate-output'; // Import from new location
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

// Export types
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


// --- Main Exported Function (Wrapper) ---
export async function decomposeProject(
  input: DecomposeProjectInput
): Promise<DecomposeProjectOutput> {
  // Validate input before calling the flow
  DecomposeProjectInputSchema.parse(input);

  await updateProjectStatus(input.projectId, 'decomposing');
  let microtasks: SchemaMicrotask[] = [];
  let primaryModel: string = '';

  try {
    primaryModel = await chooseModelBasedOnPrompt(input.projectBrief);
    console.log(`Using model ${primaryModel} for decomposition.`);

    // Construct the prompt content dynamically
    const promptContent = decompositionPromptTemplate
      .replace('{{{projectBrief}}}', input.projectBrief)
      .replace('{{#each requiredSkills}}- {{{this}}}
{{/each}}', input.requiredSkills.map(s => `- ${s}`).join('\n'));

    // Define the model for generation
    const decomposePrompt = ai.definePrompt({
        // Correctly use backticks for template literal
        name: `decomposePrompt_${primaryModel.replace(/[^a-zA-Z0-9]/g, '_')}`,
        model: primaryModel,
        input: { schema: z.object({ promptContent: z.string() }) }, // Pass the rendered content
        output: { schema: DecomposeAIOutputSchema }, // Use the correct output schema
        prompt: promptContent, // Use the constructed template directly
    });

    // Generate microtasks
    const { output } = await decomposePrompt({ promptContent }); // Pass content

    if (!output) {
      throw new Error(`AI (${primaryModel}) did not return a valid response.`);
    }

    // Validate the structure (already done by Genkit if output schema is correct)
    const parsedOutput = DecomposeAIOutputSchema.parse(output); // Ensure it matches schema

    // Perform cross-validation
    const validation = await validateAIOutput(promptContent, JSON.stringify(parsedOutput), primaryModel);
    if (!validation.allValid) {
      console.warn(`Validation failed for project decomposition (${input.projectId}). Reasoning:`, validation.results);
      throw new Error(`Project decomposition failed cross-validation.`);
    }

    // Process validated output
    const validatedTasks = validateTaskDependencies(parsedOutput); // Validate dependencies
    const nowTimestamp = Date.now();

    microtasks = validatedTasks.map(task => ({
      ...task,
      status: 'pending' as const, // Explicitly set status
      createdAt: nowTimestamp, // Add creation timestamp
    }));

    // --- Update Firestore ---
    // Convert SchemaMicrotask to ServiceMicrotask (if different)
    // Assuming they are compatible for now, otherwise mapping is needed
    const serviceMicrotasks: ServiceMicrotask[] = microtasks.map(mt => ({
        ...mt,
        // Convert Timestamps if needed (here assuming createdAt is number)
        createdAt: Timestamp.fromMillis(mt.createdAt),
        // Map other fields if ServiceMicrotask structure differs
    }));

    await updateProjectMicrotasks(input.projectId, serviceMicrotasks);
    console.log(`Decomposition successful for ${input.projectId}`);
    // Status is already set to 'decomposed' by updateProjectMicrotasks

    return { microtasks }; // Return the decomposed microtasks

  } catch (error: any) {
    console.error(`Decompose error for ${input.projectId}:`, error?.message || error);
    await updateProjectStatus(input.projectId, 'pending'); // Revert status on error
    return { microtasks: [] }; // Return empty on error
  }
}
