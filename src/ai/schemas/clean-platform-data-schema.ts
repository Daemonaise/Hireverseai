import { z } from 'zod';

export const CleanPlatformDataInputSchema = z.object({
  eventType: z.string().describe('The platform event type'),
  rawContent: z.string().describe('The raw data as a JSON string'),
  targetDatastore: z.string().describe('Which datastore this will be indexed into'),
});

export const CleanPlatformDataOutputSchema = z.object({
  accepted: z.boolean().describe('Whether the data is useful enough to index'),
  qualityScore: z.number().min(0).max(100).describe('Quality score 0-100'),
  cleanedContent: z.string().optional().describe('Cleaned and normalized content'),
  summary: z.string().optional().describe('Concise summary for indexing'),
  extractedMetadata: z.record(z.string()).optional().describe('Structured metadata extracted from content'),
  rejectionReason: z.string().optional().describe('Why the data was rejected'),
});

export type CleanPlatformDataInput = z.infer<typeof CleanPlatformDataInputSchema>;
export type CleanPlatformDataOutput = z.infer<typeof CleanPlatformDataOutputSchema>;
