'use server';

import { listEventsByStatus, updateEventStatus } from '@/services/platform-events';
import { cleanPlatformData } from '@/ai/flows/clean-platform-data';
import { indexDocument } from '@/services/vertex-ingest';
import type { PlatformEvent, DatastoreId } from '@/types/platform-events';

/**
 * Process raw platform events through the cleaning pipeline.
 * Call this on a schedule (e.g., hourly) for batch processing,
 * or immediately for high-priority events.
 */
export async function processRawEvents(
  maxEvents: number = 20
): Promise<{ processed: number; indexed: number; rejected: number; errors: number }> {
  const rawEvents = await listEventsByStatus('raw', maxEvents);

  let processed = 0;
  let indexed = 0;
  let rejected = 0;
  let errors = 0;

  for (const event of rawEvents) {
    try {
      const result = await processEvent(event);
      processed++;
      if (result === 'indexed') indexed++;
      else if (result === 'rejected') rejected++;
    } catch {
      errors++;
      // Don't update status on error — retry on next run
    }
  }

  return { processed, indexed, rejected, errors };
}

async function processEvent(
  event: PlatformEvent
): Promise<'indexed' | 'rejected'> {
  // Stage 2: Clean
  const cleanResult = await cleanPlatformData({
    eventType: event.type,
    rawContent: JSON.stringify(event.rawData),
    targetDatastore: event.targetDatastore,
  });

  if (!cleanResult.accepted) {
    await updateEventStatus(event.id, 'rejected', {
      qualityScore: cleanResult.qualityScore,
      rejectionReason: cleanResult.rejectionReason || 'Below quality threshold',
    });
    return 'rejected';
  }

  // Stage 3: Index
  const content = cleanResult.summary || cleanResult.cleanedContent || JSON.stringify(event.rawData);
  const metadata = {
    eventType: event.type,
    ...(cleanResult.extractedMetadata || {}),
  };

  await indexDocument(event.targetDatastore as DatastoreId, {
    id: event.id,
    content,
    metadata,
  });

  await updateEventStatus(event.id, 'indexed', {
    cleanedData: { content, metadata },
    qualityScore: cleanResult.qualityScore,
  });

  return 'indexed';
}

/**
 * Process a single high-priority event immediately (skip batch queue).
 * Used for assessment completions and project outcomes.
 */
export async function processEventImmediate(
  event: PlatformEvent
): Promise<'indexed' | 'rejected'> {
  return processEvent(event);
}
