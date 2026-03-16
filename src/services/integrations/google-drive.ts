'use server';

import { nango } from '@/lib/nango';
import { Timestamp } from 'firebase/firestore';
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
  const res = await nango.get({
    endpoint: '/drive/v3/files',
    providerConfigKey: config.nangoIntegrationId,
    connectionId: nangoConnectionId,
    params: {
      q: `modifiedTime > '${since.toISOString()}'`,
      fields: 'files(id,name,mimeType,modifiedTime,webViewLink,lastModifyingUser)',
      pageSize: '50',
      orderBy: 'modifiedTime desc',
    },
    retries: 2,
  });

  const files = (res.data?.files ?? []) as Array<Record<string, any>>;

  return files.map((file) => ({
    sourceProvider: 'google-drive' as const,
    sourceType: 'document' as const,
    sourceExternalId: file.id,
    title: file.name,
    bodyExcerpt: `Type: ${file.mimeType}`,
    status: '',
    assignee: file.lastModifyingUser?.displayName ?? '',
    dueDate: null,
    url: file.webViewLink || '',
    rawPayloadRef: '',
    createdAt: Timestamp.fromDate(new Date(file.modifiedTime)),
  }));
}

export async function createItem(
  nangoConnectionId: string,
  payload: CreateItemPayload
): Promise<void> {
  if (payload.type !== 'file') {
    throw new Error(`Unsupported Google Drive action type: ${payload.type}`);
  }

  await nango.post({
    endpoint: '/drive/v3/files',
    providerConfigKey: config.nangoIntegrationId,
    connectionId: nangoConnectionId,
    data: {
      name: payload.title,
      mimeType: 'application/vnd.google-apps.document',
    },
    retries: 2,
  });
}

// Google Drive doesn't support generic item updates through this interface
export async function updateItem(
  nangoConnectionId: string,
  payload: UpdateItemPayload
): Promise<void> {
  throw new Error('Google Drive does not support updateItem');
}
