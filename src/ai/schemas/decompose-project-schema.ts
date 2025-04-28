
/**
 * @fileOverview Schemas and types for the decomposeProject flow.
 */
import { z } from 'genkit';
import { Timestamp } from 'firebase/firestore'; // Import Timestamp

// Schema for a single Microtask
export const MicrotaskSchema = z.object({
    id: z.string().describe('Unique identifier for the microtask within the project (e.g., "task-001").'),
    description: z.string().min(10).describe('Detailed description of the work required for this microtask.'),
    // Ensure estimatedHours is slightly greater than 0 if present
    estimatedHours: z.number().min(0.1, { message: "Estimated hours must be greater than 0." }).optional().describe('Estimated hours required to complete this microtask (must be > 0).'),
    requiredSkill: z.string().optional().describe('The primary skill needed to complete this microtask (should ideally map to one of the project\'s required skills).'),
    dependencies: z.array(z.string()).optional().describe('List of IDs of other microtasks that must be completed before this one can start.'),
    // Status and assignment are handled post-decomposition
});
export type Microtask = z.infer<typeof MicrotaskSchema>;


// Input schema for the decomposition flow
export const DecomposeProjectInputSchema = z.object({
  projectId: z.string().describe('The unique identifier of the project to decompose.'),
  projectBrief: z.string().min(20).describe('The original project brief description.'),
  requiredSkills: z.array(z.string()).describe('The list of skills identified as required for the project.'),
});
export type DecomposeProjectInput = z.infer<typeof DecomposeProjectInputSchema>;


// Output schema for the decomposition flow
export const DecomposeProjectOutputSchema = z.object({
  microtasks: z.array(MicrotaskSchema).min(1).describe('An array of decomposed microtasks derived from the project brief.'),
});
export type DecomposeProjectOutput = z.infer<typeof DecomposeProjectOutputSchema>;

