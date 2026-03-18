/**
 * Vertex AI Search client — query datastores for RAG context retrieval.
 */

import type { DatastoreId, SearchResult } from '@/types/platform-events';
import { DATASTORE_ENV_MAP } from '@/types/platform-events';

interface SearchOptions {
  maxResults?: number;
  filter?: string;
}

function getDatastorePath(datastoreId: DatastoreId): string {
  const envKey = DATASTORE_ENV_MAP[datastoreId];
  const path = process.env[envKey];
  if (!path) {
    throw new Error(`Vertex AI Search datastore not configured: ${envKey}`);
  }
  return path;
}

/**
 * Search a Vertex AI Search datastore for relevant documents.
 * Returns ranked results with content and relevance scores.
 */
export async function searchDatastore(
  datastoreId: DatastoreId,
  query: string,
  options?: SearchOptions
): Promise<SearchResult[]> {
  const datastorePath = getDatastorePath(datastoreId);
  const maxResults = options?.maxResults ?? 5;

  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'global';

  if (!projectId) {
    throw new Error('GOOGLE_CLOUD_PROJECT is required for Vertex AI Search');
  }

  // Vertex AI Search REST API
  const endpoint = `https://discoveryengine.googleapis.com/v1/${datastorePath}/servingConfigs/default_search:search`;

  const { GoogleAuth } = await import('google-auth-library');
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const token = await client.getAccessToken();

  const body: Record<string, unknown> = {
    query,
    pageSize: maxResults,
    queryExpansionSpec: { condition: 'AUTO' },
    spellCorrectionSpec: { mode: 'AUTO' },
  };

  if (options?.filter) {
    body.filter = options.filter;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vertex AI Search query failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const results: SearchResult[] = (data.results ?? []).map((r: any) => ({
    id: r.document?.id ?? '',
    content: r.document?.derivedStructData?.extractive_answers?.[0]?.content
      ?? r.document?.derivedStructData?.snippets?.[0]?.snippet
      ?? '',
    metadata: r.document?.structData ?? {},
    relevanceScore: r.document?.relevanceScore ?? 0,
  }));

  return results;
}

/**
 * Build a RAG context string from search results for injection into prompts.
 */
export function buildRAGContext(results: SearchResult[], label?: string): string {
  if (results.length === 0) return '';

  const header = label ? `## ${label}\n` : '';
  const entries = results
    .map((r, i) => `${i + 1}. ${r.content}`)
    .join('\n');

  return `${header}${entries}\n`;
}
