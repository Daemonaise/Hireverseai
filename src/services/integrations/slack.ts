'use server';

import { nango } from '@/lib/nango';
import { Timestamp } from 'firebase/firestore';
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
  const activities: Omit<NormalizedActivity, 'id'>[] = [];

  const channelsRes = await nango.get({
    endpoint: '/api/conversations.list',
    providerConfigKey: config.nangoIntegrationId,
    connectionId: nangoConnectionId,
    params: { types: 'public_channel,private_channel', limit: '20' },
    retries: 2,
  });

  const channels = channelsRes.data?.channels ?? [];

  for (const channel of channels.slice(0, 5)) {
    const historyRes = await nango.get({
      endpoint: '/api/conversations.history',
      providerConfigKey: config.nangoIntegrationId,
      connectionId: nangoConnectionId,
      params: {
        channel: channel.id,
        oldest: String(Math.floor(since.getTime() / 1000)),
        limit: '50',
      },
      retries: 1,
    });

    const messages = historyRes.data?.messages ?? [];
    for (const msg of messages) {
      activities.push({
        sourceProvider: 'slack',
        sourceType: 'message',
        sourceExternalId: msg.ts,
        title: `Message in #${channel.name}`,
        bodyExcerpt: (msg.text || '').substring(0, 200),
        status: '',
        assignee: msg.user || '',
        dueDate: null,
        url: `https://app.slack.com/client/${channel.id}`,
        rawPayloadRef: '',
        createdAt: Timestamp.fromDate(new Date(parseFloat(msg.ts) * 1000)),
      });
    }
  }

  return activities;
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
