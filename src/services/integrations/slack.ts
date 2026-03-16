'use server';

import { nango } from '@/lib/nango';
import type { NormalizedActivity } from '@/types/hub';
import type { CreateItemPayload, UpdateItemPayload } from '@/types/hub';
import { PROVIDER_CONFIGS } from './types';

export const config = PROVIDER_CONFIGS.slack;

export function getLaunchUrl(launchUrl: string): string {
  return launchUrl || config.defaultLaunchUrl;
}

// Phase 2 — implemented in Task 18
export async function fetchActivity(
  nangoConnectionId: string,
  since: Date
): Promise<Omit<NormalizedActivity, 'id'>[]> {
  return [];
}

// Phase 4 — implemented in Task 33
export async function createItem(
  nangoConnectionId: string,
  payload: CreateItemPayload
): Promise<void> {}

// Phase 4 — Slack doesn't support generic item updates
export async function updateItem(
  nangoConnectionId: string,
  payload: UpdateItemPayload
): Promise<void> {
  throw new Error('Slack does not support updateItem');
}
