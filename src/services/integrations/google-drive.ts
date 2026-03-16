'use server';

import { nango } from '@/lib/nango';
import type { NormalizedActivity } from '@/types/hub';
import type { CreateItemPayload, UpdateItemPayload } from '@/types/hub';
import { PROVIDER_CONFIGS } from './types';

export const config = PROVIDER_CONFIGS['google-drive'];

export function getLaunchUrl(launchUrl: string): string {
  return launchUrl || config.defaultLaunchUrl;
}

export async function fetchActivity(
  nangoConnectionId: string,
  since: Date
): Promise<Omit<NormalizedActivity, 'id'>[]> {
  return [];
}

export async function createItem(
  nangoConnectionId: string,
  payload: CreateItemPayload
): Promise<void> {}

// Google Drive doesn't support generic item updates through this interface
export async function updateItem(
  nangoConnectionId: string,
  payload: UpdateItemPayload
): Promise<void> {
  throw new Error('Google Drive does not support updateItem');
}
