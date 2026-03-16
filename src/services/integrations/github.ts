'use server';

import { nango } from '@/lib/nango';
import { Timestamp } from 'firebase/firestore';
import type { NormalizedActivity, ActivitySourceType } from '@/types/hub';
import type { CreateItemPayload, UpdateItemPayload } from '@/types/hub';
import { PROVIDER_CONFIGS } from './types';

export const config = PROVIDER_CONFIGS.github;

export function getLaunchUrl(launchUrl: string): string {
  return launchUrl || config.defaultLaunchUrl;
}

export async function fetchActivity(
  nangoConnectionId: string,
  since: Date
): Promise<Omit<NormalizedActivity, 'id'>[]> {
  const res = await nango.get({
    endpoint: '/user/received_events',
    providerConfigKey: config.nangoIntegrationId,
    connectionId: nangoConnectionId,
    params: { per_page: '50' },
    retries: 2,
  });

  const events = (res.data ?? []) as Array<Record<string, any>>;
  const activities: Omit<NormalizedActivity, 'id'>[] = [];

  for (const event of events) {
    const createdAt = new Date(event.created_at);
    if (createdAt < since) continue;

    const typeMap: Record<string, ActivitySourceType> = {
      PushEvent: 'repository_event',
      IssuesEvent: 'ticket',
      IssueCommentEvent: 'ticket',
      PullRequestEvent: 'repository_event',
      CreateEvent: 'repository_event',
    };
    const sourceType = typeMap[event.type] ?? 'repository_event';

    activities.push({
      sourceProvider: 'github',
      sourceType,
      sourceExternalId: String(event.id),
      title: `${event.type} on ${event.repo?.name ?? 'unknown'}`,
      bodyExcerpt: (event.payload?.description || event.payload?.pull_request?.title || '').substring(0, 200),
      status: '',
      assignee: event.actor?.login ?? '',
      dueDate: null,
      url: event.repo ? `https://github.com/${event.repo.name}` : '',
      rawPayloadRef: '',
      createdAt: Timestamp.fromDate(createdAt),
    });
  }

  return activities;
}

export async function createItem(
  nangoConnectionId: string,
  payload: CreateItemPayload
): Promise<void> {}

// Phase 4 — update existing items (close/reopen issues, etc.)
export async function updateItem(
  nangoConnectionId: string,
  payload: UpdateItemPayload
): Promise<void> {}
