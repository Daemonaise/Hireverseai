'use server';

import { ai } from '@/lib/ai';
import { withRetry } from '@/lib/ai-retry';
import {
  CleanPlatformDataInputSchema,
  CleanPlatformDataOutputSchema,
} from '@/ai/schemas/clean-platform-data-schema';
import type { CleanPlatformDataInput } from '@/ai/schemas/clean-platform-data-schema';

export const cleanPlatformData = ai.defineFlow(
  {
    name: 'cleanPlatformData',
    inputSchema: CleanPlatformDataInputSchema,
    outputSchema: CleanPlatformDataOutputSchema,
  },
  async (input: CleanPlatformDataInput) => {
    const { output } = await withRetry(() => ai.generate({
      model: 'vertexai/gemini-2.0-flash',
      prompt: `You are a data cleaning pipeline for Hireverse AI, a freelancer marketplace platform.

## Task
Clean and evaluate the following raw platform data for indexing into our knowledge base.

## Data Type: ${input.eventType}
## Target Datastore: ${input.targetDatastore}

## Raw Data
${input.rawContent}

## Instructions

1. **Quality Score (0-100):** Rate the usefulness of this data for training our AI systems.
   - 70+: Accept as-is or with minor cleaning
   - 40-69: Needs significant cleaning but has value
   - Below 40: Reject — too noisy, incomplete, or irrelevant

2. **PII Scrubbing:** Remove ALL personally identifiable information:
   - Names → replace with role labels ("the freelancer", "the client")
   - Emails, phone numbers, addresses → remove entirely
   - Keep anonymized IDs (FL-XXXX format) intact

3. **Normalization:**
   - Standardize skill names to their canonical form
   - Fix formatting inconsistencies
   - Remove duplicate information

4. **Summarization:**
   - For verbose data, produce a concise summary (2-4 sentences) that preserves key facts
   - For structured data, extract and organize the key fields

5. **Metadata Extraction:**
   - Extract structured fields: category, skills, difficulty level, outcome, etc.
   - These become searchable filters in the datastore

Set accepted=true if qualityScore >= 40. Set accepted=false with a rejectionReason if below 40.`,
      output: { schema: CleanPlatformDataOutputSchema },
    }));

    if (!output) {
      return {
        accepted: false,
        qualityScore: 0,
        rejectionReason: 'AI cleaning produced no output',
      };
    }

    return output;
  }
);
