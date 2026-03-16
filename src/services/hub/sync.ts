import type { ProviderId } from '@/types/hub';
import { listConnections, updateConnectionStatus, updateLastSyncAt } from './connections';
import { storeActivityEvents } from './activity';
import * as slack from '@/services/integrations/slack';
import * as github from '@/services/integrations/github';
import * as googleDrive from '@/services/integrations/google-drive';
import * as trello from '@/services/integrations/trello';
import * as notion from '@/services/integrations/notion';

const providers = {
  slack,
  github,
  'google-drive': googleDrive,
  trello,
  notion,
} as const;

export interface SyncResult {
  synced: ProviderId[];
  failed: ProviderId[];
  totalEvents: number;
}

export async function syncWorkspaceActivity(
  freelancerId: string,
  workspaceId: string
): Promise<SyncResult> {
  const connections = await listConnections(freelancerId, workspaceId);
  const result: SyncResult = { synced: [], failed: [], totalEvents: 0 };

  for (const conn of connections) {
    if (conn.status === 'disconnected') continue;

    try {
      const provider = providers[conn.provider];
      const since = conn.lastSyncAt?.toDate() ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
      const events = await provider.fetchActivity(conn.nangoConnectionId, since);

      if (events.length > 0) {
        await storeActivityEvents(freelancerId, workspaceId, events);
        result.totalEvents += events.length;
      }

      await updateLastSyncAt(freelancerId, workspaceId, conn.id);
      await updateConnectionStatus(freelancerId, workspaceId, conn.id, 'connected');
      result.synced.push(conn.provider);
    } catch {
      await updateConnectionStatus(freelancerId, workspaceId, conn.id, 'error');
      result.failed.push(conn.provider);
    }
  }

  return result;
}
