# Vertex AI Migration + RAG Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all AI flows from Google AI Studio to Vertex AI, add Vertex AI Search for RAG context retrieval, and build a data cleaning pipeline for continuous knowledge indexing.

**Architecture:** Three-chunk approach: (1) Provider migration — swap `@genkit-ai/google-genai` for `@genkit-ai/vertexai` and update all model strings; (2) RAG infrastructure — Vertex AI Search client, ingestion service, and integration with 5 key flows; (3) Data pipeline — event collection, AI-powered cleaning, and automated indexing.

**Tech Stack:** Genkit + `@genkit-ai/vertexai`, Vertex AI Search API, Firebase/Firestore, Zod schemas

---

## File Map

### New Files
| File | Responsibility |
|---|---|
| `src/types/platform-events.ts` | Platform event types, datastore IDs, search result types |
| `src/lib/vertex-search.ts` | Vertex AI Search query client |
| `src/services/vertex-ingest.ts` | Document indexing (upload/delete to datastores) |
| `src/services/platform-events.ts` | Raw event collection to Firestore |
| `src/ai/schemas/clean-platform-data-schema.ts` | Zod schemas for the cleaning flow |
| `src/ai/flows/clean-platform-data.ts` | AI-powered data cleaning flow |

### Modified Files
| File | Change |
|---|---|
| `package.json` | Remove `@genkit-ai/google-genai`, add `@genkit-ai/vertexai` |
| `src/lib/ai.ts` | Swap `googleAI()` → `vertexAI()` plugin init |
| `src/lib/ai-models.ts` | Update `googleAI.model()` → `vertexAI.model()` references |
| `src/lib/ai-server-helpers.ts` | Update `GOOGLE_API_KEY` → `GOOGLE_CLOUD_PROJECT` check, update model chooser |
| `src/ai/validate-output.ts` | Update `GOOGLE_API_KEY` → `GOOGLE_CLOUD_PROJECT` check |
| `.env` | Replace `GOOGLE_API_KEY` with Vertex AI env vars |
| `src/ai/flows/*.ts` (14 files) | `googleai/` → `vertexai/` model string swap |
| `src/ai/flows/generate-project-plan.ts` | Add RAG context from `project-knowledge` datastore |
| `src/ai/flows/generate-skill-question.ts` | Add RAG context from `skill-taxonomy` datastore |
| `src/ai/flows/qa-milestone-review.ts` | Add RAG context from `qa-feedback` datastore |
| `src/ai/flows/workspace-briefing.ts` | Add RAG context from `project-knowledge` datastore |
| `src/services/hub/briefings.ts` | Emit platform event after storing briefing |

---

## Chunk 1: Provider Migration (Tasks 1-4)

### Task 1: Swap packages

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Remove google-genai, install vertexai**

```bash
npm uninstall @genkit-ai/google-genai && npm install @genkit-ai/vertexai
```

- [ ] **Step 2: Verify package.json**

Run: `grep -E "google-genai|vertexai" package.json`
Expected: Only `@genkit-ai/vertexai` appears, no `@genkit-ai/google-genai`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: swap @genkit-ai/google-genai for @genkit-ai/vertexai"
```

---

### Task 2: Update AI core config

**Files:**
- Modify: `src/lib/ai.ts`
- Modify: `src/lib/ai-models.ts`
- Modify: `src/lib/ai-server-helpers.ts`
- Modify: `src/ai/validate-output.ts`
- Modify: `.env`

- [ ] **Step 1: Update `src/lib/ai.ts`**

Replace the entire file content with:

```typescript
/**
 * @file Unified Genkit AI configuration
 * This file initializes plugins based on available environment variables.
 */

import { genkit, type GenkitPlugin } from 'genkit';
import { vertexAI } from '@genkit-ai/vertexai';
import { openAI } from '@genkit-ai/compat-oai/openai';
import { anthropic } from 'genkitx-anthropic';
import { ALL_MODELS } from './ai-models';

// --- Environment Variable Check ---
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// --- Plugin Configuration ---
const plugins: GenkitPlugin[] = [];

if (GOOGLE_CLOUD_PROJECT) {
  plugins.push(vertexAI({ projectId: GOOGLE_CLOUD_PROJECT, location: GOOGLE_CLOUD_LOCATION }));
}
if (OPENAI_API_KEY) plugins.push(openAI());
if (ANTHROPIC_API_KEY) plugins.push(anthropic());

// --- Create Genkit instance ---
export const ai = genkit({ plugins });

// Re-export all models for easy access
export const models = ALL_MODELS;
```

- [ ] **Step 2: Update `src/lib/ai-models.ts`**

Replace the entire file content with:

```typescript
/**
 * @fileoverview Centralized definitions for Genkit model objects.
 */

import { vertexAI } from '@genkit-ai/vertexai';
import { openAI } from '@genkit-ai/compat-oai/openai';
import { claude4Sonnet } from 'genkitx-anthropic';

// Model references — plugins are initialized once in ai.ts
export const MODEL_REGISTRY = {
  google: {
    flash: vertexAI.model('gemini-2.0-flash'),
  },
  openai: {
    mini: openAI.model('gpt-5-mini-2025-08-07'),
  },
  anthropic: {
    sonnet: claude4Sonnet,
  },
} as const;

// Flattened map for direct access to models
export const ALL_MODELS = {
  googleFlash: MODEL_REGISTRY.google.flash,
  openaiMini: MODEL_REGISTRY.openai.mini,
  anthropicSonnet: MODEL_REGISTRY.anthropic.sonnet,
};

// ---- TYPE HELPERS ----
export type Provider = keyof typeof MODEL_REGISTRY;
export type ModelKey<P extends Provider> = keyof (typeof MODEL_REGISTRY)[P];
export type ModelId = (typeof ALL_MODELS)[keyof typeof ALL_MODELS];
```

- [ ] **Step 3: Update `src/lib/ai-server-helpers.ts`**

Find and replace all occurrences of `GOOGLE_API_KEY` with `GOOGLE_CLOUD_PROJECT`:

```bash
sed -i 's/GOOGLE_API_KEY/GOOGLE_CLOUD_PROJECT/g' src/lib/ai-server-helpers.ts
```

Also update the env var read:
Replace: `const GOOGLE_API_KEY    = process.env.GOOGLE_API_KEY;`
With: `const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;`

- [ ] **Step 4: Update `src/ai/validate-output.ts`**

```bash
sed -i 's/GOOGLE_API_KEY/GOOGLE_CLOUD_PROJECT/g' src/ai/validate-output.ts
```

- [ ] **Step 5: Update `.env`**

Replace the `GOOGLE_API_KEY` line with:
```
# Vertex AI
GOOGLE_CLOUD_PROJECT=
GOOGLE_CLOUD_LOCATION=us-central1

# Vertex AI Search datastores
VERTEX_SEARCH_DATASTORE_SKILLS=
VERTEX_SEARCH_DATASTORE_PROJECTS=
VERTEX_SEARCH_DATASTORE_FREELANCERS=
VERTEX_SEARCH_DATASTORE_POLICIES=
VERTEX_SEARCH_DATASTORE_QA=
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai.ts src/lib/ai-models.ts src/lib/ai-server-helpers.ts src/ai/validate-output.ts .env
git commit -m "feat(ai): migrate core config from Google AI Studio to Vertex AI"
```

---

### Task 3: Swap model strings in all flows

**Files:**
- Modify: All 14 flow files with `googleai/` model strings

- [ ] **Step 1: Bulk replace model strings**

```bash
sed -i "s|'googleai/gemini-2.0-flash'|'vertexai/gemini-2.0-flash'|g" src/ai/flows/*.ts
```

- [ ] **Step 2: Verify no googleai references remain in flows**

```bash
grep -rn "googleai" src/ai/flows/*.ts
```
Expected: No output (zero matches)

- [ ] **Step 3: Also update `generate-project-idea.ts` which uses a variable**

The `generate-project-idea.ts` file sets `const modelId = 'googleai/gemini-2.0-flash';` — the sed above should catch it. Verify:

```bash
grep "googleai" src/ai/flows/generate-project-idea.ts
```
Expected: No output

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/ai/flows/
git commit -m "feat(ai): swap all flow model strings from googleai/ to vertexai/"
```

---

### Task 4: Build verification

**Files:** None (verification only)

- [ ] **Step 1: Run full build**

```bash
rm -rf .next && npx next build
```

Expected: Build succeeds with no errors. All routes render.

- [ ] **Step 2: Verify no stale google-genai imports anywhere**

```bash
grep -rn "google-genai\|googleAI" src/ --include="*.ts" | grep -v node_modules | grep -v ".next"
```
Expected: Zero matches (all references removed)

- [ ] **Step 3: Commit build fix if needed, then push**

```bash
git push
```

---

## Chunk 2: RAG Infrastructure (Tasks 5-9)

### Task 5: Platform event types

**Files:**
- Create: `src/types/platform-events.ts`

- [ ] **Step 1: Create the types file**

```typescript
import { Timestamp } from 'firebase/firestore';

// --- Event Types ---
export type PlatformEventType =
  | 'assessment_complete'
  | 'project_complete'
  | 'qa_review'
  | 'milestone_complete'
  | 'match_result';

export type EventProcessingStatus = 'raw' | 'cleaned' | 'indexed' | 'rejected';

export interface PlatformEvent {
  id: string;
  type: PlatformEventType;
  rawData: Record<string, unknown>;
  status: EventProcessingStatus;
  cleanedData?: Record<string, unknown>;
  rejectionReason?: string;
  qualityScore?: number;
  targetDatastore?: string;
  createdAt: Timestamp;
  processedAt?: Timestamp;
}

export type CreatePlatformEventInput = Omit<PlatformEvent, 'id' | 'status' | 'createdAt' | 'processedAt'> & {
  type: PlatformEventType;
  rawData: Record<string, unknown>;
};

// --- Datastore Types ---
export const DATASTORE_IDS = {
  skills: process.env.VERTEX_SEARCH_DATASTORE_SKILLS || '',
  projects: process.env.VERTEX_SEARCH_DATASTORE_PROJECTS || '',
  freelancers: process.env.VERTEX_SEARCH_DATASTORE_FREELANCERS || '',
  policies: process.env.VERTEX_SEARCH_DATASTORE_POLICIES || '',
  qa: process.env.VERTEX_SEARCH_DATASTORE_QA || '',
} as const;

export type DatastoreKey = keyof typeof DATASTORE_IDS;

export interface SearchResult {
  id: string;
  content: string;
  metadata: Record<string, string>;
  relevanceScore: number;
}

export interface IndexDocument {
  id: string;
  content: string;
  metadata: Record<string, string>;
}

// --- Timing: which events process immediately vs batch ---
export const IMMEDIATE_EVENT_TYPES: PlatformEventType[] = ['assessment_complete', 'project_complete'];
export const BATCH_EVENT_TYPES: PlatformEventType[] = ['qa_review', 'milestone_complete', 'match_result'];

// --- Event → Datastore routing ---
export const EVENT_DATASTORE_MAP: Record<PlatformEventType, DatastoreKey[]> = {
  assessment_complete: ['freelancers', 'skills'],
  project_complete: ['projects'],
  qa_review: ['qa'],
  milestone_complete: ['projects'],
  match_result: ['freelancers'],
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/types/platform-events.ts
git commit -m "feat(ai): add platform event and datastore types"
```

---

### Task 6: Vertex AI Search client

**Files:**
- Create: `src/lib/vertex-search.ts`

- [ ] **Step 1: Create the search client**

```typescript
'use server';

import type { SearchResult } from '@/types/platform-events';
import { DATASTORE_IDS, type DatastoreKey } from '@/types/platform-events';

const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

interface SearchOptions {
  maxResults?: number;
  filter?: string;
}

/**
 * Query a Vertex AI Search datastore for relevant documents.
 * Uses the Discovery Engine REST API.
 */
export async function searchDatastore(
  datastoreKey: DatastoreKey,
  query: string,
  options?: SearchOptions
): Promise<SearchResult[]> {
  const datastoreId = DATASTORE_IDS[datastoreKey];
  if (!datastoreId || !GOOGLE_CLOUD_PROJECT) {
    return []; // Gracefully return empty if not configured
  }

  const maxResults = options?.maxResults ?? 5;

  try {
    // Use the Discovery Engine API
    const endpoint = `https://discoveryengine.googleapis.com/v1/${datastoreId}/servingConfigs/default_search:search`;

    // Get access token via Application Default Credentials
    const { GoogleAuth } = await import('google-auth-library');
    const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenResponse.token}`,
      },
      body: JSON.stringify({
        query,
        pageSize: maxResults,
        queryExpansionSpec: { condition: 'AUTO' },
        spellCorrectionSpec: { mode: 'AUTO' },
        contentSearchSpec: {
          snippetSpec: { returnSnippet: true, maxSnippetCount: 3 },
          extractiveContentSpec: { maxExtractiveAnswerCount: 1 },
        },
        ...(options?.filter ? { filter: options.filter } : {}),
      }),
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const results: SearchResult[] = (data.results || []).map((r: any) => ({
      id: r.document?.id || '',
      content: r.document?.derivedStructData?.snippets?.[0]?.snippet ||
               r.document?.derivedStructData?.extractive_answers?.[0]?.content ||
               '',
      metadata: r.document?.structData || {},
      relevanceScore: r.relevanceScore || 0,
    }));

    return results;
  } catch {
    return []; // Fail silently — RAG is optional context, not critical path
  }
}

/**
 * Format search results as prompt context.
 */
export function formatRAGContext(results: SearchResult[], label: string): string {
  if (results.length === 0) return '';
  const items = results.map((r, i) => `${i + 1}. ${r.content}`).join('\n');
  return `\n## ${label} (from knowledge base)\n${items}\n`;
}
```

- [ ] **Step 2: Install google-auth-library if not present**

```bash
npm ls google-auth-library 2>/dev/null || npm install google-auth-library
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/vertex-search.ts package.json package-lock.json
git commit -m "feat(ai): add Vertex AI Search client for RAG context retrieval"
```

---

### Task 7: Document ingestion service

**Files:**
- Create: `src/services/vertex-ingest.ts`

- [ ] **Step 1: Create the ingestion service**

```typescript
'use server';

import type { IndexDocument, DatastoreKey } from '@/types/platform-events';
import { DATASTORE_IDS } from '@/types/platform-events';

const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;

async function getAuthToken(): Promise<string> {
  const { GoogleAuth } = await import('google-auth-library');
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  return tokenResponse.token || '';
}

/**
 * Index a document into a Vertex AI Search datastore.
 */
export async function indexDocument(
  datastoreKey: DatastoreKey,
  doc: IndexDocument
): Promise<void> {
  const datastoreId = DATASTORE_IDS[datastoreKey];
  if (!datastoreId || !GOOGLE_CLOUD_PROJECT) return;

  try {
    const token = await getAuthToken();
    const branchName = 'default_branch';
    const endpoint = `https://discoveryengine.googleapis.com/v1/${datastoreId}/branches/${branchName}/documents?documentId=${encodeURIComponent(doc.id)}`;

    await fetch(endpoint, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        id: doc.id,
        content: { rawBytes: Buffer.from(doc.content).toString('base64'), mimeType: 'text/plain' },
        structData: doc.metadata,
      }),
    });
  } catch {
    // Non-critical — don't fail the calling operation
  }
}

/**
 * Delete a document from a Vertex AI Search datastore.
 */
export async function deleteDocument(
  datastoreKey: DatastoreKey,
  docId: string
): Promise<void> {
  const datastoreId = DATASTORE_IDS[datastoreKey];
  if (!datastoreId || !GOOGLE_CLOUD_PROJECT) return;

  try {
    const token = await getAuthToken();
    const branchName = 'default_branch';
    const endpoint = `https://discoveryengine.googleapis.com/v1/${datastoreId}/branches/${branchName}/documents/${encodeURIComponent(docId)}`;

    await fetch(endpoint, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Non-critical
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/vertex-ingest.ts
git commit -m "feat(ai): add Vertex AI Search document ingestion service"
```

---

### Task 8: Platform events collection service

**Files:**
- Create: `src/services/platform-events.ts`

- [ ] **Step 1: Create the events service**

```typescript
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  PlatformEvent,
  PlatformEventType,
  EventProcessingStatus,
  CreatePlatformEventInput,
} from '@/types/platform-events';

const eventsRef = collection(db, 'platformEvents');

/**
 * Record a raw platform event for later processing.
 */
export async function emitPlatformEvent(
  type: PlatformEventType,
  rawData: Record<string, unknown>
): Promise<string> {
  const docRef = await addDoc(eventsRef, {
    type,
    rawData,
    status: 'raw' as EventProcessingStatus,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Fetch unprocessed events, optionally filtered by type.
 */
export async function listRawEvents(
  options?: { type?: PlatformEventType; maxCount?: number }
): Promise<PlatformEvent[]> {
  const constraints: any[] = [
    where('status', '==', 'raw'),
    orderBy('createdAt', 'asc'),
  ];
  if (options?.type) {
    constraints.push(where('type', '==', options.type));
  }
  constraints.push(firestoreLimit(options?.maxCount || 50));

  const q = query(eventsRef, ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PlatformEvent);
}

/**
 * Update event status after processing.
 */
export async function updateEventStatus(
  eventId: string,
  status: EventProcessingStatus,
  extra?: {
    cleanedData?: Record<string, unknown>;
    qualityScore?: number;
    rejectionReason?: string;
    targetDatastore?: string;
  }
): Promise<void> {
  const ref = doc(eventsRef, eventId);
  await updateDoc(ref, {
    status,
    processedAt: serverTimestamp(),
    ...extra,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/platform-events.ts
git commit -m "feat(ai): add platform events Firestore service"
```

---

### Task 9: Add RAG context to key flows

**Files:**
- Modify: `src/ai/flows/generate-project-plan.ts`
- Modify: `src/ai/flows/generate-skill-question.ts`
- Modify: `src/ai/flows/qa-milestone-review.ts`
- Modify: `src/ai/flows/workspace-briefing.ts`

- [ ] **Step 1: Update `generate-project-plan.ts`**

Add imports at the top (after existing imports):
```typescript
import { searchDatastore, formatRAGContext } from '@/lib/vertex-search';
```

Before the `ai.generate()` call, add:
```typescript
// RAG: find similar past projects
const similarProjects = await searchDatastore('projects', input.projectBrief, { maxResults: 3 });
const ragContext = formatRAGContext(similarProjects, 'Similar Past Projects');
```

Prepend `ragContext` to the prompt string (before the existing prompt content).

- [ ] **Step 2: Update `generate-skill-question.ts`**

Add the same imports. Before `ai.generate()`:
```typescript
const questionPatterns = await searchDatastore('skills', `${input.skill} ${input.difficulty} question patterns`, { maxResults: 3 });
const ragContext = formatRAGContext(questionPatterns, 'Question Patterns for This Skill');
```

Prepend to prompt.

- [ ] **Step 3: Update `qa-milestone-review.ts`**

Add imports. Before `ai.generate()`:
```typescript
const commonIssues = await searchDatastore('qa', `common issues ${input.skill || 'general'} quality review`, { maxResults: 3 });
const ragContext = formatRAGContext(commonIssues, 'Common Issues in Similar Reviews');
```

Prepend to prompt.

- [ ] **Step 4: Update `workspace-briefing.ts`**

Add imports. Before `ai.generate()`:
```typescript
const relatedProjects = await searchDatastore('projects', context || 'workspace briefing', { maxResults: 2 });
const ragContext = formatRAGContext(relatedProjects, 'Related Project Context');
```

Prepend to prompt.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/ai/flows/generate-project-plan.ts src/ai/flows/generate-skill-question.ts src/ai/flows/qa-milestone-review.ts src/ai/flows/workspace-briefing.ts
git commit -m "feat(ai): add RAG context retrieval to 4 key flows"
```

---

## Chunk 3: Data Cleaning Pipeline (Tasks 10-12)

### Task 10: Cleaning flow schemas

**Files:**
- Create: `src/ai/schemas/clean-platform-data-schema.ts`

- [ ] **Step 1: Create the schema file**

```typescript
import { z } from 'zod';

export const CleanPlatformDataInputSchema = z.object({
  eventType: z.string().describe('The type of platform event'),
  rawContent: z.string().describe('The raw text content to clean'),
  metadata: z.record(z.string()).optional().describe('Associated metadata'),
});

export const CleanPlatformDataOutputSchema = z.object({
  qualityScore: z.number().min(0).max(100).describe('Quality score 0-100'),
  accepted: z.boolean().describe('Whether the content passes quality threshold'),
  cleanedContent: z.string().describe('Cleaned, normalized content'),
  summary: z.string().describe('Concise summary of key facts'),
  extractedMetadata: z.record(z.string()).describe('Normalized metadata extracted from content'),
  rejectionReason: z.string().optional().describe('Why content was rejected, if applicable'),
});

export type CleanPlatformDataInput = z.infer<typeof CleanPlatformDataInputSchema>;
export type CleanPlatformDataOutput = z.infer<typeof CleanPlatformDataOutputSchema>;
```

- [ ] **Step 2: Commit**

```bash
git add src/ai/schemas/clean-platform-data-schema.ts
git commit -m "feat(ai): add Zod schemas for data cleaning flow"
```

---

### Task 11: Data cleaning AI flow

**Files:**
- Create: `src/ai/flows/clean-platform-data.ts`

- [ ] **Step 1: Create the cleaning flow**

```typescript
'use server';

import { ai } from '@/lib/ai';
import { withRetry } from '@/lib/ai-retry';
import {
  CleanPlatformDataInputSchema,
  CleanPlatformDataOutputSchema,
} from '@/ai/schemas/clean-platform-data-schema';
import type { CleanPlatformDataInput } from '@/ai/schemas/clean-platform-data-schema';

export const cleanPlatformData = ai.defineFlow(
  {
    name: 'cleanPlatformData',
    inputSchema: CleanPlatformDataInputSchema,
    outputSchema: CleanPlatformDataOutputSchema,
  },
  async (input: CleanPlatformDataInput) => {
    const { output } = await withRetry(() =>
      ai.generate({
        model: 'vertexai/gemini-2.0-flash',
        prompt: `You are a data quality curator for the Hireverse AI platform. Clean and assess the following platform data for indexing into our knowledge base.

## Event Type
${input.eventType}

## Raw Content
${input.rawContent}

## Metadata
${JSON.stringify(input.metadata || {}, null, 2)}

## Instructions

1. **Quality Score (0-100):** Rate the content's usefulness for future AI reference.
   - Below 40: Reject (spam, irrelevant, too vague, or corrupt)
   - 40-70: Accept with corrections (fix errors, normalize formatting)
   - 70+: Accept as-is (high-quality, informative)

2. **PII Scrubbing:** Remove ALL personal information:
   - Replace real names with role labels ("the freelancer", "the client")
   - Remove emails, phone numbers, addresses
   - Replace specific company names with generic labels if not relevant
   - Keep anonymized IDs (FL-XXXX format) as-is

3. **Normalization:**
   - Standardize skill names (e.g., "reactjs" → "React", "nodejs" → "Node.js")
   - Fix typos and grammar in summaries
   - Normalize date formats to ISO 8601
   - Extract structured metadata (skills, categories, scores)

4. **Summarization:** Create a concise summary (2-4 sentences) that captures:
   - What happened (assessment completed, project delivered, QA review)
   - Key outcomes (scores, pass/fail, issues found)
   - Actionable insights (patterns, recommendations)

5. **Set accepted=false** if qualityScore < 40, with a rejectionReason.`,
        output: { schema: CleanPlatformDataOutputSchema },
      })
    );

    if (!output) {
      return {
        qualityScore: 0,
        accepted: false,
        cleanedContent: '',
        summary: '',
        extractedMetadata: {},
        rejectionReason: 'AI cleaning flow returned no output',
      };
    }

    return output;
  }
);
```

- [ ] **Step 2: Commit**

```bash
git add src/ai/flows/clean-platform-data.ts
git commit -m "feat(ai): add data cleaning Genkit flow with PII scrubbing and quality scoring"
```

---

### Task 12: Wire event emission into existing services + build verify

**Files:**
- Modify: `src/services/hub/briefings.ts`

- [ ] **Step 1: Add event emission to `briefings.ts`**

Add import at top:
```typescript
import { emitPlatformEvent } from '@/services/platform-events';
```

After the `storeBriefing()` call inside the `workspaceBriefing` flow (in `src/ai/flows/workspace-briefing.ts`), add:
```typescript
// Emit platform event for data pipeline
emitPlatformEvent('qa_review', {
  workspaceId,
  freelancerId,
  summary: output.summary,
  actionItems: output.actionItems,
  blockers: output.blockers,
  periodStart,
  periodEnd,
}).catch(() => {}); // Fire-and-forget
```

Note: This goes in the flow file (`workspace-briefing.ts`), not the service file, since the flow has access to the AI output.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Run full build**

```bash
rm -rf .next && npx next build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/ai/flows/workspace-briefing.ts
git commit -m "feat(ai): wire platform event emission into workspace briefing flow"
```

- [ ] **Step 5: Push all changes**

```bash
git push
```
