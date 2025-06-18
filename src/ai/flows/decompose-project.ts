'use server';
/**
 * @fileOverview Decomposes a project brief into a list of actionable microtasks.
 * Exports:
 * - decomposeProject (async function)
 */

import { ai } from '@/lib/ai'; // Import the configured ai instance
import { chooseModelBasedOnPrompt } from '@/lib/ai-server-helpers'; // Import from correct location
import { validateAIOutput } from '@/ai/validate-output'; // Import from correct location
import {
  DecomposeProjectInputSchema,
  type DecomposeProjectInput,
  DecomposeProjectOutputSchema,
  type DecomposeProjectOutput,
  MicrotaskSchema, // Schema for individual microtask (used in output)
  type Microtask as SchemaMicrotask,
} from '@/ai/schemas/decompose-project-schema'; // Import types/schemas from separate file
import { updateProjectMicrotasks, updateProjectStatus } from '@/services/firestore';
import { z } from 'zod';
import type { Microtask as ServiceMicrotask } from '@/types/project';
import { Timestamp } from 'firebase/firestore';

// Define internal schemas (not exported)
const DecomposeAIOutputSchema = z.array(z.object({
  id: z.string().min(1),
  description: z.string().min(10),
  estimatedHours: z.number().min(0.1).optional(),
  requiredSkill: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
})).min(1); // Ensure at least one task

// Define prompt template (local constant)
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


// --- Helper: Validate task dependencies (local function) ---
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


// --- Main Exported Function (Wrapper - Async) ---
// This is the only export from this file.
export async function decomposeProject(
  input: DecomposeProjectInput
): Promise<DecomposeProjectOutput> {
  // Validate input before proceeding
  DecomposeProjectInputSchema.parse(input);

  await updateProjectStatus(input.projectId, 'decomposing');

  try {
    const primaryModel = await chooseModelBasedOnPrompt(input.projectBrief);
    console.log(`Using model ${primaryModel} for decomposition.`);

    // Construct the prompt content dynamically
    const promptContent = decompositionPromptTemplate
      .replace('{{{projectBrief}}}', input.projectBrief)
      .replace('{{#each requiredSkills}}- {{{this}}}
{{/each}}', input.requiredSkills.map(s => `- ${s}`).join('
'));

    // Define the model for generation inside the async function
    const decomposePrompt = ai.definePrompt({
        name: `decomposePrompt_${primaryModel.replace(/[^a-zA-Z0-9]/g, '_')}`,
        input: { schema: z.object({ promptContent: z.string() }) }, // Pass the rendered content
        output: { schema: DecomposeAIOutputSchema }, // Use the correct output schema
        prompt: promptContent,
        model: primaryModel,
    });

    // Generate microtasks
    const { output } = await decomposePrompt({ promptContent }); // Pass content

    if (!output) {
      throw new Error(`AI (${primaryModel}) did not return a valid response.`);
    }

    // Validate the structure (already done by Genkit if output schema is correct)
    const parsedOutput = DecomposeAIOutputSchema.parse(output); // Ensure it matches schema

    // Perform cross-validation
    // validateAIOutput is async and exported from its own 'use server' file
    const validation = await validateAIOutput(promptContent, JSON.stringify(parsedOutput), primaryModel);
    if (!validation.allValid) {
      console.warn(`Validation failed for project decomposition (${input.projectId}). Reasoning:`, validation.results);
      throw new Error(`Project decomposition failed cross-validation.`);
    }

    // Process validated output
    const validatedTasks = validateTaskDependencies(parsedOutput); // Validate dependencies
    const nowTimestamp = Date.now();

    const microtasks: ServiceMicrotask[] = validatedTasks.map(task => ({
      ...task,
      status: 'pending',
      createdAt: Timestamp.fromMillis(nowTimestamp),
    }));

    await updateProjectMicrotasks(input.projectId, microtasks);
    console.log(`Decomposition successful for ${input.projectId}`);

    return { microtasks }; // Return the decomposed microtasks

  } catch (error) {
    console.error(`Decompose error for ${input.projectId}:`, error);
    await updateProjectStatus(input.projectId, 'pending'); // Revert status on error
    return { microtasks: [] }; // Return empty on error
  }
}
