import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Timestamp } from 'firebase/firestore';
import type { WorkspaceConnection, ProviderId, ConnectionStatus } from '@/types/hub';
import { storeActivityEvents } from './activity';

function connectionsCol(freelancerId: string, workspaceId: string) {
  return collection(
    db, 'freelancers', freelancerId, 'workspaces', workspaceId, 'connections'
  );
}

function connectionDoc(freelancerId: string, workspaceId: string, connectionId: string) {
  return doc(
    db, 'freelancers', freelancerId, 'workspaces', workspaceId, 'connections', connectionId
  );
}

export async function createConnection(
  freelancerId: string,
  workspaceId: string,
  provider: ProviderId,
  nangoConnectionId: string,
  nangoIntegrationId: string,
  label: string,
  launchUrl: string
): Promise<string> {
  const ref = await addDoc(connectionsCol(freelancerId, workspaceId), {
    provider,
    nangoConnectionId,
    nangoIntegrationId,
    label,
    launchUrl,
    status: 'connected' as ConnectionStatus,
    lastSyncAt: null,
    createdAt: serverTimestamp(),
  });
  // Log audit event
  await logConnectionEvent(freelancerId, workspaceId, provider, `Connected ${label}`);
  return ref.id;
}

export async function getConnection(
  freelancerId: string,
  workspaceId: string,
  connectionId: string
): Promise<WorkspaceConnection | null> {
  const snap = await getDoc(connectionDoc(freelancerId, workspaceId, connectionId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as WorkspaceConnection;
}

export async function listConnections(
  freelancerId: string,
  workspaceId: string
): Promise<WorkspaceConnection[]> {
  const snap = await getDocs(connectionsCol(freelancerId, workspaceId));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as WorkspaceConnection));
}

export async function getConnectionByProvider(
  freelancerId: string,
  workspaceId: string,
  provider: ProviderId
): Promise<WorkspaceConnection | null> {
  const q = query(connectionsCol(freelancerId, workspaceId), where('provider', '==', provider));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as WorkspaceConnection;
}

export async function updateConnectionStatus(
  freelancerId: string,
  workspaceId: string,
  connectionId: string,
  status: ConnectionStatus
): Promise<void> {
  await updateDoc(connectionDoc(freelancerId, workspaceId, connectionId), { status });
}

export async function updateLastSyncAt(
  freelancerId: string,
  workspaceId: string,
  connectionId: string
): Promise<void> {
  await updateDoc(connectionDoc(freelancerId, workspaceId, connectionId), {
    lastSyncAt: serverTimestamp(),
  });
}

export async function deleteConnection(
  freelancerId: string,
  workspaceId: string,
  connectionId: string,
  provider?: ProviderId,
  label?: string
): Promise<void> {
  await deleteDoc(connectionDoc(freelancerId, workspaceId, connectionId));
  if (provider) {
    await logConnectionEvent(freelancerId, workspaceId, provider, `Disconnected ${label || provider}`);
  }
}

async function logConnectionEvent(
  freelancerId: string,
  workspaceId: string,
  provider: ProviderId,
  title: string
): Promise<void> {
  try {
    await storeActivityEvents(freelancerId, workspaceId, [{
      sourceProvider: provider,
      sourceType: 'connection_event',
      sourceExternalId: `conn-${Date.now()}`,
      title,
      bodyExcerpt: '',
      status: '',
      assignee: '',
      dueDate: null,
      url: '',
      rawPayloadRef: '',
      createdAt: Timestamp.now(),
    }]);
  } catch {
    // Don't fail the main operation if audit logging fails
  }
}
