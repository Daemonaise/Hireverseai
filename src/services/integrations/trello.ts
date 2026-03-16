'use server';

import { nango } from '@/lib/nango';
import { Timestamp } from 'firebase/firestore';
import type { NormalizedActivity, ActivitySourceType } from '@/types/hub';
import type { CreateItemPayload, UpdateItemPayload } from '@/types/hub';
import { PROVIDER_CONFIGS } from './types';

export const config = PROVIDER_CONFIGS.trello;

export function getLaunchUrl(launchUrl: string): string {
  return launchUrl || config.defaultLaunchUrl;
}

export async function fetchActivity(
  nangoConnectionId: string,
  since: Date
): Promise<Omit<NormalizedActivity, 'id'>[]> {
  const boardsRes = await nango.get({
    endpoint: '/1/members/me/boards',
    providerConfigKey: config.nangoIntegrationId,
    connectionId: nangoConnectionId,
    params: { fields: 'id,name', filter: 'open' },
    retries: 2,
  });

  const boards = (boardsRes.data ?? []) as Array<Record<string, any>>;
  const activities: Omit<NormalizedActivity, 'id'>[] = [];

  for (const board of boards.slice(0, 5)) {
    const actionsRes = await nango.get({
      endpoint: `/1/boards/${board.id}/actions`,
      providerConfigKey: config.nangoIntegrationId,
      connectionId: nangoConnectionId,
      params: { since: since.toISOString(), limit: '50' },
      retries: 1,
    });

    const actions = (actionsRes.data ?? []) as Array<Record<string, any>>;
    const typeMap: Record<string, ActivitySourceType> = {
      createCard: 'task',
      updateCard: 'task',
      commentCard: 'message',
      addAttachmentToCard: 'document',
    };

    for (const action of actions) {
      const sourceType = typeMap[action.type] ?? 'task';
      activities.push({
        sourceProvider: 'trello',
        sourceType,
        sourceExternalId: action.id,
        title: `${action.type} on ${board.name}`,
        bodyExcerpt: (action.data?.text || action.data?.card?.name || '').substring(0, 200),
        status: '',
        assignee: action.memberCreator?.fullName ?? '',
        dueDate: null,
        url: action.data?.card ? `https://trello.com/c/${action.data.card.shortLink}` : '',
        rawPayloadRef: '',
        createdAt: Timestamp.fromDate(new Date(action.date)),
      });
    }
  }

  return activities;
}

export async function createItem(
  nangoConnectionId: string,
  payload: CreateItemPayload
): Promise<void> {
  if (payload.type !== 'card') {
    throw new Error(`Unsupported Trello action type: ${payload.type}`);
  }
  if (!payload.metadata?.listId) {
    throw new Error('List ID is required for Trello cards');
  }

  await nango.post({
    endpoint: '/1/cards',
    providerConfigKey: config.nangoIntegrationId,
    connectionId: nangoConnectionId,
    data: {
      name: payload.title,
      desc: payload.body || '',
      idList: payload.metadata.listId,
    },
    retries: 2,
  });
}

export async function updateItem(
  nangoConnectionId: string,
  payload: UpdateItemPayload
): Promise<void> {
  if (payload.type !== 'card') {
    throw new Error(`Unsupported Trello update type: ${payload.type}`);
  }

  await nango.put({
    endpoint: `/1/cards/${payload.externalId}`,
    providerConfigKey: config.nangoIntegrationId,
    connectionId: nangoConnectionId,
    data: payload.updates,
    retries: 2,
  });
}
