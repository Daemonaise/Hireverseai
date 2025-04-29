// src/ai/schemas/decompose-project-schema.ts

import { z } from 'zod';

// --- Define allowed microtask statuses ---
export const MicrotaskStatusSchema = z.enum([
  'pending',
  'in_progress',
  'assigned',
  'submitted',
  'approved',
  'rejected',
]);
export type MicrotaskStatus = z.infer<typeof MicrotaskStatusSchema>;

// --- Define Microtask Schema ---
export const MicrotaskSchema = z.object({
  id: z.string().describe('Unique identifier for the microtask within the project (e.g., "task-001").'),
  description: z.string().min(10).describe('Detailed description of the work required for this microtask.'),
  estimatedHours: z.number().min(0.1).optional().describe('Estimated hours required to complete this microtask (must be > 0).'),
  requiredSkill: z.string().optional().describe('Primary skill needed for this microtask (should ideally map to a project skill).'),
  dependencies: z.array(z.string()).optional().describe('IDs of other microtasks that must be completed first.'),
  status: MicrotaskStatusSchema.default('pending').describe('The current status of the microtask. Defaults to "pending".'),
  createdAt: z.number().describe('Unix timestamp (in milliseconds) when the microtask was created.'),
});
export type Microtask = z.infer<typeof MicrotaskSchema>;

// --- Define Input Schema for decomposition ---
export const DecomposeProjectInputSchema = z.object({
  projectId: z.string().describe('Unique identifier for the project being decomposed.'),
  projectBrief: z.string().min(20).describe('Brief description of the overall project to decompose.'),
  requiredSkills: z.array(z.string()).min(1).describe('List of skills identified as necessary for the project.'),
});
export type DecomposeProjectInput = z.infer<typeof DecomposeProjectInputSchema>;

// --- Define Output Schema for decomposition ---
export const DecomposeProjectOutputSchema = z.object({
  microtasks: z.array(MicrotaskSchema).min(1).describe('List of microtasks that decompose the project. Each must have status and createdAt filled.'),
});
export type DecomposeProjectOutput = z.infer<typeof DecomposeProjectOutputSchema>;
