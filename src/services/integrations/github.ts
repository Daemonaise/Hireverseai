'use server';

import { getNango } from '@/lib/nango';
import { Timestamp } from 'firebase/firestore';
import type { NormalizedActivity, ActivitySourceType } from '@/types/hub';
import type { CreateItemPayload, UpdateItemPayload } from '@/types/hub';
import { PROVIDER_CONFIGS } from './types';

const config = PROVIDER_CONFIGS.github;

function getLaunchUrl(launchUrl: string): string {
  return launchUrl || config.defaultLaunchUrl;
}

export async function fetchActivity(
  nangoConnectionId: string,
  since: Date
): Promise<Omit<NormalizedActivity, 'id'>[]> {
  const res = await getNango().get({
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
): Promise<void> {
  if (payload.type !== 'issue') {
    throw new Error(`Unsupported GitHub action type: ${payload.type}`);
  }
  if (!payload.metadata?.repo) {
    throw new Error('Repo (owner/repo format) is required for GitHub issues');
  }

  await getNango().post({
    endpoint: `/repos/${payload.metadata.repo}/issues`,
    providerConfigKey: config.nangoIntegrationId,
    connectionId: nangoConnectionId,
    data: { title: payload.title, body: payload.body || '' },
    retries: 2,
  });
}

// Phase 4 — update existing items (close/reopen issues, etc.)
export async function updateItem(
  nangoConnectionId: string,
  payload: UpdateItemPayload
): Promise<void> {
  if (payload.type !== 'issue') {
    throw new Error(`Unsupported GitHub update type: ${payload.type}`);
  }
  if (!payload.updates.repo) {
    throw new Error('Repo is required for updating GitHub issues');
  }

  await getNango().patch({
    endpoint: `/repos/${payload.updates.repo}/issues/${payload.externalId}`,
    providerConfigKey: config.nangoIntegrationId,
    connectionId: nangoConnectionId,
    data: payload.updates,
    retries: 2,
  });
}
