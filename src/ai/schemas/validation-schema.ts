/**
 * @fileOverview Schema for AI output validation results.
 */
import { z } from 'zod';

export const ValidationSchema = z.object({
  isValid: z.boolean().describe("Whether the original output is valid and accurate based on the original request."),
  reasoning: z.string().optional().describe("Explanation if invalid, or brief confirmation if valid."),
});

export type ValidationResult = z.infer<typeof ValidationSchema>;
