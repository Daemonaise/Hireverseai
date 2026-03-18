/**
 * Vertex AI Search document ingestion — upload/delete documents in datastores.
 */

import type { DatastoreId, IndexDocument } from '@/types/platform-events';
import { DATASTORE_ENV_MAP } from '@/types/platform-events';

function getDatastorePath(datastoreId: DatastoreId): string {
  const envKey = DATASTORE_ENV_MAP[datastoreId];
  const path = process.env[envKey];
  if (!path) {
    throw new Error(`Vertex AI Search datastore not configured: ${envKey}`);
  }
  return path;
}

async function getAuthToken(): Promise<string> {
  const { GoogleAuth } = await import('google-auth-library');
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return token.token ?? '';
}

/**
 * Index a document into a Vertex AI Search datastore.
 */
export async function indexDocument(
  datastoreId: DatastoreId,
  doc: IndexDocument
): Promise<void> {
  const datastorePath = getDatastorePath(datastoreId);
  const endpoint = `https://discoveryengine.googleapis.com/v1/${datastorePath}/documents?documentId=${encodeURIComponent(doc.id)}`;
  const token = await getAuthToken();

  const body = {
    id: doc.id,
    structData: {
      ...doc.metadata,
      content: doc.content,
    },
    content: {
      mimeType: 'text/plain',
      rawBytes: Buffer.from(doc.content).toString('base64'),
    },
  };

  const response = await fetch(endpoint, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vertex AI Search index failed: ${response.status} ${errorText}`);
  }
}

/**
 * Delete a document from a Vertex AI Search datastore.
 */
export async function deleteDocument(
  datastoreId: DatastoreId,
  docId: string
): Promise<void> {
  const datastorePath = getDatastorePath(datastoreId);
  const endpoint = `https://discoveryengine.googleapis.com/v1/${datastorePath}/documents/${encodeURIComponent(docId)}`;
  const token = await getAuthToken();

  const response = await fetch(endpoint, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    const errorText = await response.text();
    throw new Error(`Vertex AI Search delete failed: ${response.status} ${errorText}`);
  }
}

/**
 * Batch index multiple documents into a datastore.
 */
export async function batchIndexDocuments(
  datastoreId: DatastoreId,
  docs: IndexDocument[]
): Promise<{ indexed: number; failed: number }> {
  let indexed = 0;
  let failed = 0;

  for (const doc of docs) {
    try {
      await indexDocument(datastoreId, doc);
      indexed++;
    } catch {
      failed++;
    }
  }

  return { indexed, failed };
}
