'use server';

import { nango } from '@/lib/nango';
import { Timestamp } from 'firebase/firestore';
import type { NormalizedActivity, ActivitySourceType } from '@/types/hub';
import type { CreateItemPayload, UpdateItemPayload } from '@/types/hub';
import { PROVIDER_CONFIGS } from './types';

export const config = PROVIDER_CONFIGS.notion;

export function getLaunchUrl(launchUrl: string): string {
  return launchUrl || config.defaultLaunchUrl;
}

export async function fetchActivity(
  nangoConnectionId: string,
  since: Date
): Promise<Omit<NormalizedActivity, 'id'>[]> {
  const res = await nango.post({
    endpoint: '/v1/search',
    providerConfigKey: config.nangoIntegrationId,
    connectionId: nangoConnectionId,
    data: {
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
      page_size: 50,
    },
    headers: { 'Notion-Version': '2022-06-28' },
    retries: 2,
  });

  const results = (res.data?.results ?? []) as Array<Record<string, any>>;

  return results
    .filter((item) => new Date(item.last_edited_time) >= since)
    .map((item) => ({
      sourceProvider: 'notion' as const,
      sourceType: (item.object === 'database' ? 'task' : 'document') as ActivitySourceType,
      sourceExternalId: item.id,
      title: item.properties?.title?.title?.[0]?.plain_text || item.properties?.Name?.title?.[0]?.plain_text || 'Untitled',
      bodyExcerpt: `${item.object} — last edited ${item.last_edited_time}`,
      status: '',
      assignee: '',
      dueDate: null,
      url: item.url || '',
      rawPayloadRef: '',
      createdAt: Timestamp.fromDate(new Date(item.last_edited_time)),
    }));
}

export async function createItem(
  nangoConnectionId: string,
  payload: CreateItemPayload
): Promise<void> {
  if (payload.type !== 'page') {
    throw new Error(`Unsupported Notion action type: ${payload.type}`);
  }
  if (!payload.metadata?.databaseId) {
    throw new Error('Database ID is required for Notion pages');
  }

  await nango.post({
    endpoint: '/v1/pages',
    providerConfigKey: config.nangoIntegrationId,
    connectionId: nangoConnectionId,
    data: {
      parent: { database_id: payload.metadata.databaseId },
      properties: {
        title: { title: [{ text: { content: payload.title } }] },
      },
      children: payload.body
        ? [{ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ text: { content: payload.body } }] } }]
        : [],
    },
    headers: { 'Notion-Version': '2022-06-28' },
    retries: 2,
  });
}

export async function updateItem(
  nangoConnectionId: string,
  payload: UpdateItemPayload
): Promise<void> {
  if (payload.type !== 'page') {
    throw new Error(`Unsupported Notion update type: ${payload.type}`);
  }

  await nango.patch({
    endpoint: `/v1/pages/${payload.externalId}`,
    providerConfigKey: config.nangoIntegrationId,
    connectionId: nangoConnectionId,
    data: { properties: payload.updates },
    headers: { 'Notion-Version': '2022-06-28' },
    retries: 2,
  });
}
