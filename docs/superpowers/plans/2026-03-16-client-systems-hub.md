# Client Systems Hub Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the freelancer dashboard with a workspace-based Client Systems Hub that connects to external tools (Slack, GitHub, Google Drive, Trello, Notion) via Nango-managed OAuth, aggregates activity, provides AI-powered briefings and chat, and supports write-back actions.

**Architecture:** Modular service architecture — each development phase maps to independent modules with clear boundaries. Nango handles all OAuth flows, token storage, and token refresh. Provider services use the Nango proxy for authenticated API calls. Workspaces are Firestore subcollections under freelancer documents. AI flows follow existing Genkit patterns.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Firebase Auth + Firestore, Genkit AI, Zod, Nango (`@nangohq/node` + `@nangohq/frontend`)

**Spec:** `docs/superpowers/specs/2026-03-16-client-systems-hub-design.md`

---

## Nango Integration Overview

Nango replaces all custom OAuth code. Instead of managing OAuth URLs, token exchange, token refresh, and encrypted storage ourselves, Nango handles all of this:

- **Auth flows**: Frontend uses `@nangohq/frontend` to open a Connect UI popup. Nango handles the OAuth redirect, consent screen, and token exchange.
- **Token storage**: Nango stores and encrypts all OAuth tokens. We never see raw tokens — we store only a `nangoConnectionId` in our Firestore connection documents.
- **Token refresh**: Nango auto-refreshes tokens before they expire. No `refreshIfExpired()` needed.
- **API proxy**: `@nangohq/node` provides `nango.get()`, `nango.post()`, etc. that inject auth headers automatically. Provider services call these instead of raw `fetch()`.
- **Integration config**: OAuth client IDs, secrets, scopes, and callback URLs are configured in the Nango dashboard — not in our codebase.

**Nango connection ID convention:** `{workspaceId}-{provider}` (e.g., `abc123-slack`). This ensures workspace-level token isolation.

**Env vars needed:** `NANGO_SECRET_KEY` (server), `NEXT_PUBLIC_NANGO_PUBLIC_KEY` (client).

---

## File Map

### New Files

```
src/types/hub.ts                                    → All hub type definitions
src/lib/nango.ts                                    → Server-side Nango client singleton
src/services/hub/workspaces.ts                      → Workspace CRUD (Firestore)
src/services/hub/connections.ts                     → Connection CRUD (Firestore, stores nangoConnectionId)
src/services/hub/bookmarks.ts                       → Bookmark CRUD (Firestore)
src/services/hub/notes.ts                           → Note CRUD (Firestore)
src/services/hub/activity.ts                        → Activity event CRUD (Firestore) — Phase 2
src/services/hub/sync.ts                            → Sync orchestrator — Phase 2
src/services/hub/briefings.ts                       → AI briefing CRUD (Firestore) — Phase 3
src/services/hub/ai-context.ts                      → AI context doc generation — Phase 3
src/services/integrations/types.ts                  → Provider display config + shared interfaces
src/services/integrations/slack.ts                  → Slack: activity fetch, write actions (via Nango proxy)
src/services/integrations/github.ts                 → GitHub: activity fetch, write actions (via Nango proxy)
src/services/integrations/google-drive.ts           → Google Drive: activity fetch, write actions (via Nango proxy)
src/services/integrations/trello.ts                 → Trello: activity fetch, write actions (via Nango proxy)
src/services/integrations/notion.ts                 → Notion: activity fetch, write actions (via Nango proxy)
src/app/freelancer/hub/layout.tsx                   → Hub layout with sidebar
src/app/freelancer/hub/page.tsx                     → Hub dashboard page
src/app/freelancer/hub/[workspaceId]/page.tsx       → Workspace detail page
src/app/api/hub/nango-session/route.ts              → Creates Nango connect sessions for frontend
src/app/api/hub/chat/route.ts                       → Workspace chat API — Phase 3
src/components/hub/hub-sidebar.tsx                  → Sidebar navigation
src/components/hub/hub-dashboard.tsx                → Workspace cards grid
src/components/hub/workspace-card.tsx               → Single workspace card
src/components/hub/workspace-detail.tsx             → Tabbed workspace view
src/components/hub/connection-tile.tsx              → Connected app tile
src/components/hub/connection-setup-dialog.tsx      → Nango Connect UI trigger
src/components/hub/bookmark-list.tsx                → Bookmark CRUD
src/components/hub/note-editor.tsx                  → Note CRUD
src/components/hub/access-permissions.tsx           → Permissions & audit tab
src/components/hub/activity-timeline.tsx            → Activity feed — Phase 2
src/components/hub/ai-briefing-panel.tsx            → AI briefing display — Phase 3
src/components/hub/workspace-chat.tsx               → AI chat UI — Phase 3
src/ai/flows/workspace-briefing.ts                  → Briefing generation flow — Phase 3
src/ai/flows/workspace-chat-agent.ts                → Chat agent flow — Phase 3
src/ai/flows/workspace-qa-review.ts                 → QA review flow — Phase 3
src/ai/schemas/workspace-briefing-schema.ts         → Briefing Zod schemas — Phase 3
src/ai/schemas/workspace-chat-schema.ts             → Chat Zod schemas — Phase 3
src/ai/schemas/workspace-qa-review-schema.ts        → QA review Zod schemas — Phase 3
```

### Modified Files

```
src/app/freelancer/dashboard/page.tsx               → Redirect to /freelancer/hub
src/components/header-navigation-client.tsx          → Add "Hub" nav link for freelancers
package.json                                        → Add @nangohq/node, @nangohq/frontend
```

### NOT Created (Nango replaces these)

```
src/services/integrations/oauth.ts                  → NOT NEEDED: Nango handles all OAuth
src/app/api/integrations/[provider]/callback/route.ts → NOT NEEDED: Nango handles callbacks
```

---

## Chunk 1: Phase 1A — Data Layer & Nango Setup

Sets up dependencies, types, Nango client, and all Firestore services. No UI in this chunk.

### Task 1: Install Nango Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Nango packages**

```bash
npm install @nangohq/node @nangohq/frontend
```

- [ ] **Step 2: Verify install succeeded**

Run: `ls node_modules/@nangohq/node/package.json && ls node_modules/@nangohq/frontend/package.json`
Expected: Both files exist

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install Nango SDK packages"
```

---

### Task 2: Type Definitions

**Files:**
- Create: `src/types/hub.ts`

- [ ] **Step 1: Create hub type definitions**

```typescript
// src/types/hub.ts
import { Timestamp, FieldValue } from 'firebase/firestore';

// --- Provider ---

export type ProviderId = 'slack' | 'github' | 'google-drive' | 'trello' | 'notion';

export type ProviderCategory = 'communication' | 'code' | 'files' | 'project-management' | 'docs';

export interface ProviderDisplayConfig {
  id: ProviderId;
  name: string;
  icon: string; // Lucide icon name
  category: ProviderCategory;
  nangoIntegrationId: string; // Nango integration key configured in Nango dashboard
  defaultLaunchUrl: string;
}

// --- Workspace ---

export type WorkspaceStatus = 'active' | 'archived';

export interface Workspace {
  id: string;
  name: string;
  clientName: string;
  engagementType: string; // free-text: "retainer", "contract", etc.
  status: WorkspaceStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp | FieldValue;
}

export type CreateWorkspaceInput = Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'>;

// --- Connection ---

export type ConnectionStatus = 'connected' | 'disconnected' | 'error';

export interface WorkspaceConnection {
  id: string;
  provider: ProviderId;
  nangoConnectionId: string; // Nango-managed connection ID
  nangoIntegrationId: string; // Nango integration key
  label: string;
  launchUrl: string;
  status: ConnectionStatus;
  lastSyncAt: Timestamp | null;
  createdAt: Timestamp;
}

// --- Bookmark ---

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  description: string;
  createdAt: Timestamp;
}

export type CreateBookmarkInput = Omit<Bookmark, 'id' | 'createdAt'>;

// --- Note ---

export interface Note {
  id: string;
  title: string;
  content: string; // markdown
  createdAt: Timestamp;
  updatedAt: Timestamp | FieldValue;
}

export type CreateNoteInput = Omit<Note, 'id' | 'createdAt' | 'updatedAt'>;

// --- Activity Event (Phase 2) ---

export type ActivitySourceType = 'task' | 'message' | 'document' | 'ticket' | 'repository_event';

export interface NormalizedActivity {
  id: string;
  sourceProvider: ProviderId;
  sourceType: ActivitySourceType;
  sourceExternalId: string;
  title: string;
  bodyExcerpt: string;
  status: string;
  assignee: string;
  dueDate: Timestamp | null;
  url: string;
  rawPayloadRef: string;
  createdAt: Timestamp;
  updatedAt: Timestamp | FieldValue;
}

// --- AI Briefing (Phase 3) ---

export interface AIBriefing {
  id: string;
  generatedAt: Timestamp;
  periodStart: Timestamp;
  periodEnd: Timestamp;
  summary: string;
  actionItems: string[];
  blockers: string[];
  model: string;
}

// --- QA Review (Phase 3) ---

export interface QAReviewIssue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  suggestion: string;
}

export interface QAReviewResult {
  passed: boolean;
  score: number;
  feedback: string;
  issues: QAReviewIssue[];
}

// --- Write Actions (Phase 4) ---

export interface CreateItemPayload {
  type: 'issue' | 'message' | 'file' | 'card' | 'page';
  title: string;
  body?: string;
  metadata?: Record<string, string>;
}

export interface UpdateItemPayload {
  externalId: string;
  type: 'issue' | 'card' | 'page';
  updates: Record<string, unknown>;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/types/hub.ts 2>&1 | head -20`
Expected: No errors (or only pre-existing Genkit/Zod errors unrelated to hub.ts)

- [ ] **Step 3: Commit**

```bash
git add src/types/hub.ts
git commit -m "feat(hub): add type definitions for Client Systems Hub"
```

---

### Task 3: Nango Server Client

**Files:**
- Create: `src/lib/nango.ts`

- [ ] **Step 1: Create Nango client singleton**

```typescript
// src/lib/nango.ts
import { Nango } from '@nangohq/node';

const secretKey = process.env.NANGO_SECRET_KEY;

if (!secretKey && process.env.NODE_ENV === 'production') {
  throw new Error('NANGO_SECRET_KEY is required for hub integrations');
}

export const nango = new Nango({ secretKey: secretKey || '' });
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/nango.ts
git commit -m "feat(hub): add Nango server client singleton"
```

---

### Task 4: Integration Display Types

**Files:**
- Create: `src/services/integrations/types.ts`

- [ ] **Step 1: Create provider display configs**

```typescript
// src/services/integrations/types.ts
import type { ProviderId, ProviderDisplayConfig } from '@/types/hub';

// Display-only config. OAuth credentials/scopes are configured in Nango dashboard.
export const PROVIDER_CONFIGS: Record<ProviderId, ProviderDisplayConfig> = {
  slack: {
    id: 'slack',
    name: 'Slack',
    icon: 'MessageSquare',
    category: 'communication',
    nangoIntegrationId: 'slack',
    defaultLaunchUrl: 'https://app.slack.com',
  },
  github: {
    id: 'github',
    name: 'GitHub',
    icon: 'Github',
    category: 'code',
    nangoIntegrationId: 'github',
    defaultLaunchUrl: 'https://github.com',
  },
  'google-drive': {
    id: 'google-drive',
    name: 'Google Drive',
    icon: 'HardDrive',
    category: 'files',
    nangoIntegrationId: 'google-drive',
    defaultLaunchUrl: 'https://drive.google.com',
  },
  trello: {
    id: 'trello',
    name: 'Trello',
    icon: 'LayoutGrid',
    category: 'project-management',
    nangoIntegrationId: 'trello',
    defaultLaunchUrl: 'https://trello.com',
  },
  notion: {
    id: 'notion',
    name: 'Notion',
    icon: 'BookOpen',
    category: 'docs',
    nangoIntegrationId: 'notion',
    defaultLaunchUrl: 'https://notion.so',
  },
};

export function getProviderConfig(provider: ProviderId): ProviderDisplayConfig {
  return PROVIDER_CONFIGS[provider];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/integrations/types.ts
git commit -m "feat(hub): add provider display configs"
```

---

### Task 5: Firestore Workspace Service

**Files:**
- Create: `src/services/hub/workspaces.ts`

- [ ] **Step 1: Create workspace CRUD service**

```typescript
// src/services/hub/workspaces.ts
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Workspace, CreateWorkspaceInput, WorkspaceStatus } from '@/types/hub';

function workspacesCol(freelancerId: string) {
  return collection(db, 'freelancers', freelancerId, 'workspaces');
}

function workspaceDoc(freelancerId: string, workspaceId: string) {
  return doc(db, 'freelancers', freelancerId, 'workspaces', workspaceId);
}

export async function createWorkspace(
  freelancerId: string,
  input: CreateWorkspaceInput
): Promise<string> {
  const ref = await addDoc(workspacesCol(freelancerId), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getWorkspace(
  freelancerId: string,
  workspaceId: string
): Promise<Workspace | null> {
  const snap = await getDoc(workspaceDoc(freelancerId, workspaceId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Workspace;
}

export async function listWorkspaces(
  freelancerId: string,
  status?: WorkspaceStatus
): Promise<Workspace[]> {
  const col = workspacesCol(freelancerId);
  const q = status
    ? query(col, where('status', '==', status), orderBy('updatedAt', 'desc'))
    : query(col, orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Workspace));
}

export async function updateWorkspace(
  freelancerId: string,
  workspaceId: string,
  updates: Partial<Pick<Workspace, 'name' | 'clientName' | 'engagementType' | 'status'>>
): Promise<void> {
  await updateDoc(workspaceDoc(freelancerId, workspaceId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function archiveWorkspace(
  freelancerId: string,
  workspaceId: string
): Promise<void> {
  await updateWorkspace(freelancerId, workspaceId, { status: 'archived' });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/hub/workspaces.ts
git commit -m "feat(hub): add workspace Firestore CRUD service"
```

---

### Task 6: Firestore Connection Service (Nango-backed)

**Files:**
- Create: `src/services/hub/connections.ts`

- [ ] **Step 1: Create connection CRUD service**

This service stores Nango connection references — **not** raw tokens. Nango manages all token storage and refresh.

```typescript
// src/services/hub/connections.ts
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
import type { WorkspaceConnection, ProviderId, ConnectionStatus } from '@/types/hub';

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
  connectionId: string
): Promise<void> {
  await deleteDoc(connectionDoc(freelancerId, workspaceId, connectionId));
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/hub/connections.ts
git commit -m "feat(hub): add connection Firestore CRUD service (Nango-backed)"
```

---

### Task 7: Firestore Bookmark & Note Services

**Files:**
- Create: `src/services/hub/bookmarks.ts`
- Create: `src/services/hub/notes.ts`

- [ ] **Step 1: Create bookmark service**

```typescript
// src/services/hub/bookmarks.ts
import {
  collection,
  doc,
  addDoc,
  getDocs,
  deleteDoc,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Bookmark, CreateBookmarkInput } from '@/types/hub';

function bookmarksCol(freelancerId: string, workspaceId: string) {
  return collection(
    db, 'freelancers', freelancerId, 'workspaces', workspaceId, 'bookmarks'
  );
}

export async function addBookmark(
  freelancerId: string,
  workspaceId: string,
  input: CreateBookmarkInput
): Promise<string> {
  const ref = await addDoc(bookmarksCol(freelancerId, workspaceId), {
    ...input,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listBookmarks(
  freelancerId: string,
  workspaceId: string
): Promise<Bookmark[]> {
  const q = query(bookmarksCol(freelancerId, workspaceId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Bookmark));
}

export async function deleteBookmark(
  freelancerId: string,
  workspaceId: string,
  bookmarkId: string
): Promise<void> {
  await deleteDoc(doc(bookmarksCol(freelancerId, workspaceId), bookmarkId));
}
```

- [ ] **Step 2: Create note service**

```typescript
// src/services/hub/notes.ts
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Note, CreateNoteInput } from '@/types/hub';

function notesCol(freelancerId: string, workspaceId: string) {
  return collection(
    db, 'freelancers', freelancerId, 'workspaces', workspaceId, 'notes'
  );
}

export async function addNote(
  freelancerId: string,
  workspaceId: string,
  input: CreateNoteInput
): Promise<string> {
  const ref = await addDoc(notesCol(freelancerId, workspaceId), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getNote(
  freelancerId: string,
  workspaceId: string,
  noteId: string
): Promise<Note | null> {
  const snap = await getDoc(doc(notesCol(freelancerId, workspaceId), noteId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Note;
}

export async function listNotes(
  freelancerId: string,
  workspaceId: string
): Promise<Note[]> {
  const q = query(notesCol(freelancerId, workspaceId), orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Note));
}

export async function updateNote(
  freelancerId: string,
  workspaceId: string,
  noteId: string,
  updates: Partial<Pick<Note, 'title' | 'content'>>
): Promise<void> {
  await updateDoc(doc(notesCol(freelancerId, workspaceId), noteId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteNote(
  freelancerId: string,
  workspaceId: string,
  noteId: string
): Promise<void> {
  await deleteDoc(doc(notesCol(freelancerId, workspaceId), noteId));
}
```

- [ ] **Step 3: Commit**

```bash
git add src/services/hub/bookmarks.ts src/services/hub/notes.ts
git commit -m "feat(hub): add bookmark and note Firestore services"
```

---

### Task 8: Provider Service Stubs (Nango Proxy)

**Files:**
- Create: `src/services/integrations/slack.ts`
- Create: `src/services/integrations/github.ts`
- Create: `src/services/integrations/google-drive.ts`
- Create: `src/services/integrations/trello.ts`
- Create: `src/services/integrations/notion.ts`

All provider services use `nango.get()` / `nango.post()` for authenticated API calls. Phase 1 stubs include `fetchActivity` and `createItem` placeholders. `getLaunchUrl` returns the default URL for the provider.

- [ ] **Step 1: Create Slack provider**

```typescript
// src/services/integrations/slack.ts
'use server';

import { nango } from '@/lib/nango';
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
  return [];
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
```

- [ ] **Step 2: Create GitHub provider**

```typescript
// src/services/integrations/github.ts
'use server';

import { nango } from '@/lib/nango';
import type { NormalizedActivity } from '@/types/hub';
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
  return [];
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
```

- [ ] **Step 3: Create Google Drive provider**

```typescript
// src/services/integrations/google-drive.ts
'use server';

import { nango } from '@/lib/nango';
import type { NormalizedActivity } from '@/types/hub';
import type { CreateItemPayload, UpdateItemPayload } from '@/types/hub';
import { PROVIDER_CONFIGS } from './types';

export const config = PROVIDER_CONFIGS['google-drive'];

export function getLaunchUrl(launchUrl: string): string {
  return launchUrl || config.defaultLaunchUrl;
}

export async function fetchActivity(
  nangoConnectionId: string,
  since: Date
): Promise<Omit<NormalizedActivity, 'id'>[]> {
  return [];
}

export async function createItem(
  nangoConnectionId: string,
  payload: CreateItemPayload
): Promise<void> {}

// Google Drive doesn't support generic item updates through this interface
export async function updateItem(
  nangoConnectionId: string,
  payload: UpdateItemPayload
): Promise<void> {
  throw new Error('Google Drive does not support updateItem');
}
```

- [ ] **Step 4: Create Trello provider**

```typescript
// src/services/integrations/trello.ts
'use server';

import { nango } from '@/lib/nango';
import type { NormalizedActivity } from '@/types/hub';
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
  return [];
}

export async function createItem(
  nangoConnectionId: string,
  payload: CreateItemPayload
): Promise<void> {}

export async function updateItem(
  nangoConnectionId: string,
  payload: UpdateItemPayload
): Promise<void> {}
```

- [ ] **Step 5: Create Notion provider**

```typescript
// src/services/integrations/notion.ts
'use server';

import { nango } from '@/lib/nango';
import type { NormalizedActivity } from '@/types/hub';
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
  return [];
}

export async function createItem(
  nangoConnectionId: string,
  payload: CreateItemPayload
): Promise<void> {}

export async function updateItem(
  nangoConnectionId: string,
  payload: UpdateItemPayload
): Promise<void> {}
```

- [ ] **Step 6: Commit**

```bash
git add src/services/integrations/slack.ts src/services/integrations/github.ts \
  src/services/integrations/google-drive.ts src/services/integrations/trello.ts \
  src/services/integrations/notion.ts
git commit -m "feat(hub): add provider service stubs using Nango proxy"
```

---

### Task 9: Nango Session API Route

**Files:**
- Create: `src/app/api/hub/nango-session/route.ts`

- [ ] **Step 1: Create Nango session endpoint**

The frontend calls this to get a connect session token before opening the Nango Connect UI.

```typescript
// src/app/api/hub/nango-session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { nango } from '@/lib/nango';

export async function POST(req: NextRequest) {
  try {
    const { freelancerId, workspaceId, provider } = await req.json();

    if (!freelancerId || !workspaceId || !provider) {
      return NextResponse.json(
        { error: 'freelancerId, workspaceId, and provider are required' },
        { status: 400 }
      );
    }

    // TODO: Verify freelancerId matches authenticated user

    // The nangoConnectionId convention is {workspaceId}-{provider}
    // This is constructed by the frontend when saving the connection to Firestore
    const { data } = await nango.createConnectSession({
      tags: {
        end_user_id: freelancerId,
        workspace_id: workspaceId,
      },
      allowed_integrations: [provider],
    });

    return NextResponse.json({ sessionToken: data.token, workspaceId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/hub/nango-session/route.ts
git commit -m "feat(hub): add Nango connect session API endpoint"
```

---

### Task 9b: API Route Auth Helper

**Files:**
- Create: `src/lib/api-auth.ts`

- [ ] **Step 1: Create auth verification helper for API routes**

Create a helper that verifies the Firebase Auth ID token from the `Authorization: Bearer <token>` header. This uses the Firebase Admin SDK for server-side token verification.

```typescript
// src/lib/api-auth.ts
import { NextRequest } from 'next/server';

// Firebase Admin SDK must be initialized separately for server-side auth verification.
// For now, extract the UID from the token using the Firebase Auth REST API.
// TODO: Replace with firebase-admin SDK when available.

export async function verifyAuthToken(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const idToken = authHeader.slice(7);
  if (!idToken) return null;

  try {
    // Verify via Google's tokeninfo endpoint (works without Admin SDK)
    const res = await fetch(
      `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getAccountInfo?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.users?.[0]?.localId ?? null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Update Nango session route to verify auth**

In `src/app/api/hub/nango-session/route.ts`, replace the `// TODO` comment with:

```typescript
import { verifyAuthToken } from '@/lib/api-auth';

// Inside POST handler, after parsing body:
const uid = await verifyAuthToken(req);
if (!uid) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
// Verify the freelancerId matches the authenticated user
// For now, trust the mapping — add freelancerId lookup when user model supports it
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/api-auth.ts src/app/api/hub/nango-session/route.ts
git commit -m "feat(hub): add API route auth verification helper"
```

---

## Chunk 2: Phase 1B — UI Layer

Builds all Phase 1 UI: hub layout, sidebar, dashboard, workspace detail, connection management, bookmarks, notes, permissions tab, dashboard redirect, and nav update.

### Task 10: Hub Layout & Sidebar

**Files:**
- Create: `src/app/freelancer/hub/layout.tsx`
- Create: `src/components/hub/hub-sidebar.tsx`

- [ ] **Step 1: Create hub sidebar component**

Build a sidebar that lists workspaces (active and archived), has a "New Workspace" button, and highlights the current workspace. It receives `freelancerId` as a prop, fetches workspaces via `listWorkspaces()`, and uses `usePathname()` to highlight the active workspace. Active workspaces show first, archived in a collapsible section. Each workspace links to `/freelancer/hub/[workspaceId]`. Use shadcn `Button`, `ScrollArea`, `Separator`, and Lucide icons (`Plus`, `Archive`, `FolderOpen`). Follow the existing design system: `bg-white border-r`, no gradients.

- [ ] **Step 2: Create hub layout**

Build a layout component at `src/app/freelancer/hub/layout.tsx` that renders:
- The existing `HeaderNavigationClient` at the top
- A flex container below with `HubSidebar` (w-64, shrink-0) on the left and `{children}` filling the rest
- Get the freelancerId from auth context if available, falling back to `"dev-react-001"` (matching the existing dashboard pattern)
- Mark as `'use client'`

- [ ] **Step 3: Commit**

```bash
git add src/app/freelancer/hub/layout.tsx src/components/hub/hub-sidebar.tsx
git commit -m "feat(hub): add hub layout with sidebar navigation"
```

---

### Task 11: Hub Dashboard Page & Workspace Card

**Files:**
- Create: `src/app/freelancer/hub/page.tsx`
- Create: `src/components/hub/hub-dashboard.tsx`
- Create: `src/components/hub/workspace-card.tsx`

- [ ] **Step 1: Create workspace card component**

Build a card that displays: workspace name, client name, engagement type, status badge (green for active, gray for archived), icons for connected providers (fetched via `listConnections()`), and a "last updated" timestamp. Clicking the card navigates to `/freelancer/hub/[workspaceId]`. Use shadcn `Card`, `Badge`. Follow design system: `rounded-xl border hover:-translate-y-0.5 transition-transform`.

- [ ] **Step 2: Create hub dashboard component**

Build the main dashboard grid. It receives `freelancerId` as a prop. Fetches workspaces via `listWorkspaces()`. Renders a header ("Client Systems Hub") with a "New Workspace" `Button` that opens a dialog. Below, a responsive grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`) of `WorkspaceCard` components. The "New Workspace" dialog collects: workspace name, client name, engagement type (free-text input). On submit calls `createWorkspace()` and refreshes the list.

- [ ] **Step 3: Create hub page**

```typescript
// src/app/freelancer/hub/page.tsx
'use client';

import { HubDashboard } from '@/components/hub/hub-dashboard';

// TODO: Replace with real auth — matches existing dashboard pattern
const FREELANCER_ID = 'dev-react-001';

export default function HubPage() {
  return <HubDashboard freelancerId={FREELANCER_ID} />;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/freelancer/hub/page.tsx src/components/hub/hub-dashboard.tsx \
  src/components/hub/workspace-card.tsx
git commit -m "feat(hub): add hub dashboard page with workspace cards"
```

---

### Task 12: Workspace Detail Page & Tabbed View

**Files:**
- Create: `src/app/freelancer/hub/[workspaceId]/page.tsx`
- Create: `src/components/hub/workspace-detail.tsx`

- [ ] **Step 1: Create workspace detail component**

Build a tabbed workspace view using shadcn `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`. Phase 1 tabs: **Overview**, **Apps**, **Notes**, **Access & Permissions**. The component receives `freelancerId` and `workspaceId` as props. Fetches workspace data via `getWorkspace()`.

**Overview tab**: Shows workspace info (name, client, engagement type, status) and a bookmarks section using `BookmarkList`. Also migrate the existing dashboard project management UI from `src/components/freelancer-dashboard.tsx`:
  - (a) Extract the project list rendering (project cards with name, status badge, required skills, due date)
  - (b) Call `getAssignedProjects(freelancerId)` from `@/services/firestore` to get the freelancer's Hireverse projects
  - (c) Render each project with its status, skills, and estimated delivery date
  - (d) Wire up the existing status selector and work submission UI if present in the original dashboard
  - The original dashboard component can remain for reference — the redirect in Task 16 ensures users land on the hub

**Apps tab**: Renders `ConnectionTile` components for each connection plus an "Add Connection" button that opens `ConnectionSetupDialog`.

**Notes tab**: Renders `NoteEditor`.

**Access & Permissions tab**: Renders `AccessPermissions`.

Use a `Loader2` spinner while data loads.

- [ ] **Step 2: Create workspace detail page**

```typescript
// src/app/freelancer/hub/[workspaceId]/page.tsx
'use client';

import { use } from 'react';
import { WorkspaceDetail } from '@/components/hub/workspace-detail';

const FREELANCER_ID = 'dev-react-001';

export default function WorkspaceDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  return <WorkspaceDetail freelancerId={FREELANCER_ID} workspaceId={workspaceId} />;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/freelancer/hub/[workspaceId]/page.tsx \
  src/components/hub/workspace-detail.tsx
git commit -m "feat(hub): add workspace detail page with tabbed view"
```

---

### Task 13: Connection Tile & Setup Dialog (Nango Connect UI)

**Files:**
- Create: `src/components/hub/connection-tile.tsx`
- Create: `src/components/hub/connection-setup-dialog.tsx`

- [ ] **Step 1: Create connection tile**

Build a tile component that displays a connected app: provider icon (mapped from `PROVIDER_CONFIGS`), label, status dot (green=connected, yellow=disconnected, red=error), last synced timestamp, and a "Launch" button that opens the provider's URL in a new tab. Also a "Disconnect" button that calls `deleteConnection()` after confirmation. Use shadcn `Button`, `Badge`. Tile style: `flex items-center gap-4 p-4 rounded-lg border`.

- [ ] **Step 2: Create connection setup dialog**

Build a dialog that allows connecting a new integration using Nango's Connect UI. Shows a grid of available providers from `PROVIDER_CONFIGS` (filtered to exclude already-connected ones). Each provider is a clickable card showing icon, name, and category.

On click:
1. POST to `/api/hub/nango-session` with `{ freelancerId, workspaceId, provider: config.nangoIntegrationId }` to get a session token
2. Create Nango frontend instance and open Connect UI:

```typescript
import NangoFrontend from '@nangohq/frontend';

const nangoFrontend = new NangoFrontend({ publicKey: process.env.NEXT_PUBLIC_NANGO_PUBLIC_KEY! });
const connect = nangoFrontend.openConnectUI({
  onEvent: (event) => {
    if (event.type === 'connect') {
      // Save connection to Firestore
      createConnection(
        freelancerId,
        workspaceId,
        providerId,
        event.payload.connectionId,
        config.nangoIntegrationId,
        config.name,
        config.defaultLaunchUrl
      );
    }
  },
});
connect.setSessionToken(sessionToken);
```

3. On success, save the connection to Firestore and refresh the connections list

Use shadcn `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`.

- [ ] **Step 3: Commit**

```bash
git add src/components/hub/connection-tile.tsx src/components/hub/connection-setup-dialog.tsx
git commit -m "feat(hub): add connection tile and Nango Connect UI setup dialog"
```

---

### Task 14: Bookmark List & Note Editor

**Files:**
- Create: `src/components/hub/bookmark-list.tsx`
- Create: `src/components/hub/note-editor.tsx`

- [ ] **Step 1: Create bookmark list**

Build a component that lists bookmarks for a workspace and allows adding/deleting. Shows each bookmark as a row: title (as a link to the URL), description, delete button. "Add Bookmark" form at the top with inputs for title, URL, description. Calls `addBookmark()` / `listBookmarks()` / `deleteBookmark()`. Use shadcn `Input`, `Button`, `Card`. Props: `freelancerId`, `workspaceId`.

- [ ] **Step 2: Create note editor**

Build a component that lists notes and allows CRUD. Left panel: note titles list with "New Note" button. Right panel: selected note with title input and a textarea for markdown content. Auto-saves on blur via `updateNote()`. Delete button per note. Calls `addNote()` / `listNotes()` / `updateNote()` / `deleteNote()`. Use shadcn `Input`, `Textarea`, `Button`, `ScrollArea`. Props: `freelancerId`, `workspaceId`.

- [ ] **Step 3: Commit**

```bash
git add src/components/hub/bookmark-list.tsx src/components/hub/note-editor.tsx
git commit -m "feat(hub): add bookmark list and note editor components"
```

---

### Task 15: Access & Permissions Tab

**Files:**
- Create: `src/components/hub/access-permissions.tsx`

- [ ] **Step 1: Create access permissions component**

Build a component that shows all connections with their integration details, provides per-connection revocation (calls `deleteConnection()`), and lists connection status. For each connection: provider name, icon, status badge, Nango integration ID, "Connected since" date, "Revoke" button with confirmation dialog. Props: `freelancerId`, `workspaceId`. Uses `listConnections()`. Use shadcn `Card`, `Badge`, `Button`, `AlertDialog`.

- [ ] **Step 2: Commit**

```bash
git add src/components/hub/access-permissions.tsx
git commit -m "feat(hub): add access and permissions component"
```

---

### Task 16: Dashboard Redirect & Nav Update

**Files:**
- Modify: `src/app/freelancer/dashboard/page.tsx`
- Modify: `src/components/header-navigation-client.tsx`

- [ ] **Step 1: Redirect old dashboard to hub**

Replace the contents of `src/app/freelancer/dashboard/page.tsx` with a redirect:

```typescript
import { redirect } from 'next/navigation';

export default function FreelancerDashboardPage() {
  redirect('/freelancer/hub');
}
```

- [ ] **Step 2: Update header navigation**

In `src/components/header-navigation-client.tsx`, add a "Hub" link that points to `/freelancer/hub`. Add it alongside the existing navigation items (between "Community" and "Client Portal"). Use the same `Link` styling as the "Community" link.

- [ ] **Step 3: Verify the dev server loads without errors**

Run: `npm run dev` (check that `/freelancer/hub` loads, `/freelancer/dashboard` redirects)

- [ ] **Step 4: Commit**

```bash
git add src/app/freelancer/dashboard/page.tsx src/components/header-navigation-client.tsx
git commit -m "feat(hub): redirect dashboard to hub, update nav links"
```

---

## Chunk 3: Phase 2 — Activity Aggregation

Implements real API calls through Nango proxy for each provider, stores normalized events in Firestore, and adds Timeline/Tasks/Messages/Files tabs to workspace detail.

### Task 17: Activity Event Firestore Service

**Files:**
- Create: `src/services/hub/activity.ts`

- [ ] **Step 1: Create activity event CRUD service**

```typescript
// src/services/hub/activity.ts
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { NormalizedActivity, ProviderId, ActivitySourceType } from '@/types/hub';

function activityCol(freelancerId: string, workspaceId: string) {
  return collection(
    db, 'freelancers', freelancerId, 'workspaces', workspaceId, 'activityEvents'
  );
}

export async function storeActivityEvents(
  freelancerId: string,
  workspaceId: string,
  events: Omit<NormalizedActivity, 'id'>[]
): Promise<void> {
  const col = activityCol(freelancerId, workspaceId);
  // Firestore batches are limited to 500 operations
  const BATCH_SIZE = 499;
  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = events.slice(i, i + BATCH_SIZE);
    for (const event of chunk) {
      // Use composite key for deduplication: re-syncing the same event overwrites rather than duplicates
      const docId = `${event.sourceProvider}-${event.sourceExternalId}`;
      const ref = doc(col, docId);
      batch.set(ref, { ...event, updatedAt: serverTimestamp() });
    }
    await batch.commit();
  }
}

export async function listActivityEvents(
  freelancerId: string,
  workspaceId: string,
  options?: {
    provider?: ProviderId;
    sourceType?: ActivitySourceType;
    since?: Date;
    limit?: number;
  }
): Promise<NormalizedActivity[]> {
  const col = activityCol(freelancerId, workspaceId);
  const constraints = [orderBy('createdAt', 'desc')];

  if (options?.provider) {
    constraints.unshift(where('sourceProvider', '==', options.provider));
  }
  if (options?.sourceType) {
    constraints.unshift(where('sourceType', '==', options.sourceType));
  }
  if (options?.since) {
    constraints.unshift(where('createdAt', '>=', Timestamp.fromDate(options.since)));
  }
  if (options?.limit) {
    constraints.push(firestoreLimit(options.limit));
  }

  const q = query(col, ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as NormalizedActivity));
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/hub/activity.ts
git commit -m "feat(hub): add activity event Firestore service"
```

---

### Task 18: Slack Activity Fetcher (Nango Proxy)

**Files:**
- Modify: `src/services/integrations/slack.ts`

- [ ] **Step 1: Implement Slack fetchActivity**

Replace the placeholder `fetchActivity` with a real implementation using Nango proxy. Calls Slack `conversations.list` then `conversations.history` for each channel:

```typescript
export async function fetchActivity(
  nangoConnectionId: string,
  since: Date
): Promise<Omit<NormalizedActivity, 'id'>[]> {
  const activities: Omit<NormalizedActivity, 'id'>[] = [];

  // Get user's channels
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
```

Add the necessary imports at the top of the file: `import { Timestamp } from 'firebase/firestore';`

- [ ] **Step 2: Commit**

```bash
git add src/services/integrations/slack.ts
git commit -m "feat(hub): implement Slack activity fetcher via Nango proxy"
```

---

### Task 19: GitHub Activity Fetcher (Nango Proxy)

**Files:**
- Modify: `src/services/integrations/github.ts`

- [ ] **Step 1: Implement GitHub fetchActivity**

Replace the placeholder. Uses Nango proxy to call GitHub Events API:

```typescript
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
```

Add imports: `import { Timestamp } from 'firebase/firestore';` and `import type { ActivitySourceType } from '@/types/hub';`

- [ ] **Step 2: Commit**

```bash
git add src/services/integrations/github.ts
git commit -m "feat(hub): implement GitHub activity fetcher via Nango proxy"
```

---

### Task 20: Google Drive Activity Fetcher (Nango Proxy)

**Files:**
- Modify: `src/services/integrations/google-drive.ts`

- [ ] **Step 1: Implement Google Drive fetchActivity**

Replace placeholder. Calls Drive API via Nango proxy to list recently modified files:

```typescript
export async function fetchActivity(
  nangoConnectionId: string,
  since: Date
): Promise<Omit<NormalizedActivity, 'id'>[]> {
  const res = await nango.get({
    endpoint: '/drive/v3/files',
    providerConfigKey: config.nangoIntegrationId,
    connectionId: nangoConnectionId,
    params: {
      q: `modifiedTime > '${since.toISOString()}'`,
      fields: 'files(id,name,mimeType,modifiedTime,webViewLink,lastModifyingUser)',
      pageSize: '50',
      orderBy: 'modifiedTime desc',
    },
    retries: 2,
  });

  const files = (res.data?.files ?? []) as Array<Record<string, any>>;

  return files.map((file) => ({
    sourceProvider: 'google-drive' as const,
    sourceType: 'document' as const,
    sourceExternalId: file.id,
    title: file.name,
    bodyExcerpt: `Type: ${file.mimeType}`,
    status: '',
    assignee: file.lastModifyingUser?.displayName ?? '',
    dueDate: null,
    url: file.webViewLink || '',
    rawPayloadRef: '',
    createdAt: Timestamp.fromDate(new Date(file.modifiedTime)),
  }));
}
```

Add imports: `import { Timestamp } from 'firebase/firestore';`

- [ ] **Step 2: Commit**

```bash
git add src/services/integrations/google-drive.ts
git commit -m "feat(hub): implement Google Drive activity fetcher via Nango proxy"
```

---

### Task 21: Trello Activity Fetcher (Nango Proxy)

**Files:**
- Modify: `src/services/integrations/trello.ts`

- [ ] **Step 1: Implement Trello fetchActivity**

Replace placeholder. Calls Trello API via Nango proxy:

```typescript
export async function fetchActivity(
  nangoConnectionId: string,
  since: Date
): Promise<Omit<NormalizedActivity, 'id'>[]> {
  // Get user's boards
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
```

Add imports: `import { Timestamp } from 'firebase/firestore';` and `import type { ActivitySourceType } from '@/types/hub';`

- [ ] **Step 2: Commit**

```bash
git add src/services/integrations/trello.ts
git commit -m "feat(hub): implement Trello activity fetcher via Nango proxy"
```

---

### Task 22: Notion Activity Fetcher (Nango Proxy)

**Files:**
- Modify: `src/services/integrations/notion.ts`

- [ ] **Step 1: Implement Notion fetchActivity**

Replace placeholder. Calls Notion search API via Nango proxy:

```typescript
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
```

Add imports: `import { Timestamp } from 'firebase/firestore';` and `import type { ActivitySourceType } from '@/types/hub';`

- [ ] **Step 2: Commit**

```bash
git add src/services/integrations/notion.ts
git commit -m "feat(hub): implement Notion activity fetcher via Nango proxy"
```

---

### Task 23: Sync Orchestrator

**Files:**
- Create: `src/services/hub/sync.ts`

- [ ] **Step 1: Create sync orchestrator**

```typescript
// src/services/hub/sync.ts
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
      // Nango handles token refresh automatically — just pass the connectionId
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
```

- [ ] **Step 2: Commit**

```bash
git add src/services/hub/sync.ts
git commit -m "feat(hub): add activity sync orchestrator"
```

---

### Task 24: Activity Timeline Component

**Files:**
- Create: `src/components/hub/activity-timeline.tsx`

- [ ] **Step 1: Create activity timeline**

Build a component that displays normalized activity events as a vertical timeline. Props: `freelancerId`, `workspaceId`, `filterSourceType?: ActivitySourceType | ActivitySourceType[]` (for tab-specific filtering). Features:
- "Sync Now" button that calls `syncWorkspaceActivity()` and shows a toast with results
- Filter controls: provider dropdown (all/slack/github/etc.), source type dropdown (all/task/message/document/ticket/repository_event)
- Event list: each event shows provider icon, title, body excerpt (truncated to 120 chars), status badge, timestamp, and a "Open" link to the source URL
- Sorted by `createdAt` desc
- Uses `listActivityEvents()` with filter options
- Loading state with `Loader2` spinner
- Empty state: "No activity yet. Connect an app and sync to get started."
- Use shadcn `Card`, `Badge`, `Button`, `Select`, `ScrollArea`

- [ ] **Step 2: Commit**

```bash
git add src/components/hub/activity-timeline.tsx
git commit -m "feat(hub): add activity timeline component"
```

---

### Task 25: Add Phase 2 Tabs to Workspace Detail

**Files:**
- Modify: `src/components/hub/workspace-detail.tsx`

- [ ] **Step 1: Add Tasks, Messages, Files, Timeline tabs**

Update `workspace-detail.tsx` to add four new tabs:
- **Tasks** — renders `ActivityTimeline` filtered to `sourceType: ['task', 'ticket']`
- **Messages** — renders `ActivityTimeline` filtered to `sourceType: 'message'`
- **Files** — renders `ActivityTimeline` filtered to `sourceType: 'document'`
- **Timeline** — renders the full unfiltered `ActivityTimeline`

All tabs pass `freelancerId` and `workspaceId` to the timeline component.

- [ ] **Step 2: Verify dev server renders all tabs**

Run: `npm run dev`, navigate to `/freelancer/hub/{workspaceId}`, verify all 8 tabs render without errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/hub/workspace-detail.tsx
git commit -m "feat(hub): add Phase 2 tabs (Tasks, Messages, Files, Timeline)"
```

---

### Task 25b: Unread Counts & Deadline Indicators on Workspace Cards

**Files:**
- Modify: `src/services/hub/workspaces.ts`
- Modify: `src/components/hub/workspace-card.tsx`

- [ ] **Step 1: Add lastVisitedAt tracking**

Add a `lastVisitedAt` field to the `Workspace` type in `src/types/hub.ts`. Add an `updateLastVisitedAt(freelancerId, workspaceId)` function to `workspaces.ts` that sets `lastVisitedAt` to the current server timestamp. Call this function when the workspace detail page loads (in `workspace-detail.tsx` via a `useEffect`).

- [ ] **Step 2: Add unread badge and deadline indicator to workspace card**

Update `workspace-card.tsx` to:
- Fetch activity events since `workspace.lastVisitedAt` using `listActivityEvents({ since })` and display the count as an unread badge (e.g., red circle with number) on the card
- Find the nearest upcoming `dueDate` from activity events and display it as "Next deadline: {date}" on the card
- If no unread events, don't show the badge

- [ ] **Step 3: Commit**

```bash
git add src/types/hub.ts src/services/hub/workspaces.ts \
  src/components/hub/workspace-card.tsx src/components/hub/workspace-detail.tsx
git commit -m "feat(hub): add unread counts and deadline indicators to workspace cards"
```

---

### Task 25c: Connection Audit Log

**Files:**
- Modify: `src/types/hub.ts`
- Modify: `src/services/hub/connections.ts`
- Modify: `src/components/hub/access-permissions.tsx`

- [ ] **Step 1: Add connection audit event type and logging**

Add `'connection_event'` to the `ActivitySourceType` union in `src/types/hub.ts`. In `connections.ts`, after `createConnection()`, `deleteConnection()`, and `updateConnectionStatus()` calls, log an activity event using `storeActivityEvents()` with `sourceType: 'connection_event'`, `sourceProvider` set to the connection's provider, and `title` describing the action (e.g., "Connected Slack", "Disconnected GitHub", "GitHub connection error").

- [ ] **Step 2: Display audit log in Access & Permissions tab**

Update `access-permissions.tsx` to fetch and display connection events by calling `listActivityEvents({ sourceType: 'connection_event' })`. Show them as a chronological list below the connections table: timestamp, action description, and provider icon.

- [ ] **Step 3: Commit**

```bash
git add src/types/hub.ts src/services/hub/connections.ts \
  src/components/hub/access-permissions.tsx
git commit -m "feat(hub): add connection audit log to access & permissions tab"
```

---

## Chunk 4: Phase 3 — AI Operations Layer

Adds AI context document generation, workspace briefing flow, conversational chat agent, QA review flow, and the AI Briefing tab UI.

### Task 26: AI Context Document Service

**Files:**
- Create: `src/services/hub/ai-context.ts`

- [ ] **Step 1: Create AI context generator**

```typescript
// src/services/hub/ai-context.ts
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getWorkspace } from './workspaces';
import { listConnections } from './connections';
import { listNotes } from './notes';
import { listBookmarks } from './bookmarks';
import { getAssignedProjects } from '@/services/firestore';

export async function generateAIContext(
  freelancerId: string,
  workspaceId: string
): Promise<string> {
  const workspace = await getWorkspace(freelancerId, workspaceId);
  if (!workspace) throw new Error('Workspace not found');

  const connections = await listConnections(freelancerId, workspaceId);
  const notes = await listNotes(freelancerId, workspaceId);
  const bookmarks = await listBookmarks(freelancerId, workspaceId);
  const projects = await getAssignedProjects(freelancerId);

  let md = `# Workspace: ${workspace.clientName}\n\n`;
  md += `## Engagement\n`;
  md += `- Type: ${workspace.engagementType}\n`;
  md += `- Status: ${workspace.status}\n`;
  md += `- Created: ${workspace.createdAt.toDate().toISOString()}\n\n`;

  md += `## Connected Systems\n`;
  if (connections.length === 0) {
    md += `- No systems connected\n`;
  } else {
    for (const c of connections) {
      md += `- ${c.label} (${c.provider}): ${c.status} — connected since ${c.createdAt.toDate().toISOString()}\n`;
    }
  }
  md += `\n`;

  md += `## Active Hireverse Projects\n`;
  const activeProjects = projects.filter(
    (p) => p.status !== 'completed' && p.status !== 'cancelled'
  );
  if (activeProjects.length === 0) {
    md += `- No active projects\n`;
  } else {
    for (const p of activeProjects) {
      md += `- ${p.name}: ${p.status}, skills: ${p.requiredSkills.join(', ')}`;
      if (p.estimatedDeliveryDate) {
        md += `, due: ${p.estimatedDeliveryDate.toDate().toISOString()}`;
      }
      md += `\n`;
    }
  }
  md += `\n`;

  md += `## Notes Summary\n`;
  if (notes.length === 0) {
    md += `- No notes\n`;
  } else {
    for (const n of notes) {
      md += `- ${n.title}: ${n.content.substring(0, 200)}${n.content.length > 200 ? '...' : ''}\n`;
    }
  }
  md += `\n`;

  md += `## Bookmarks\n`;
  if (bookmarks.length === 0) {
    md += `- No bookmarks\n`;
  } else {
    for (const b of bookmarks) {
      md += `- [${b.title}](${b.url}): ${b.description}\n`;
    }
  }
  md += `\n`;

  md += `## Workspace Rules\n`;
  md += `- Data from this workspace must NEVER be shared with other workspaces\n`;
  md += `- This freelancer's role: ${workspace.engagementType}\n`;
  md += `- Only reference data within this workspace context\n`;

  // Store in Firestore
  const contextRef = doc(
    db, 'freelancers', freelancerId, 'workspaces', workspaceId, 'aiContext', 'current'
  );
  await setDoc(contextRef, { markdown: md, updatedAt: serverTimestamp() });

  return md;
}

export async function getAIContext(
  freelancerId: string,
  workspaceId: string
): Promise<string | null> {
  const contextRef = doc(
    db, 'freelancers', freelancerId, 'workspaces', workspaceId, 'aiContext', 'current'
  );
  const snap = await getDoc(contextRef);
  if (!snap.exists()) return null;
  return snap.data().markdown as string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/hub/ai-context.ts
git commit -m "feat(hub): add AI context document generator"
```

---

### Task 27: AI Briefing Firestore Service

**Files:**
- Create: `src/services/hub/briefings.ts`

- [ ] **Step 1: Create briefing CRUD service**

```typescript
// src/services/hub/briefings.ts
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit as firestoreLimit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { AIBriefing } from '@/types/hub';

function briefingsCol(freelancerId: string, workspaceId: string) {
  return collection(
    db, 'freelancers', freelancerId, 'workspaces', workspaceId, 'aiBriefings'
  );
}

export async function storeBriefing(
  freelancerId: string,
  workspaceId: string,
  briefing: Omit<AIBriefing, 'id'>
): Promise<string> {
  const ref = await addDoc(briefingsCol(freelancerId, workspaceId), briefing);
  return ref.id;
}

export async function getLatestBriefing(
  freelancerId: string,
  workspaceId: string
): Promise<AIBriefing | null> {
  const q = query(
    briefingsCol(freelancerId, workspaceId),
    orderBy('generatedAt', 'desc'),
    firestoreLimit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as AIBriefing;
}

export async function listBriefings(
  freelancerId: string,
  workspaceId: string,
  count: number = 10
): Promise<AIBriefing[]> {
  const q = query(
    briefingsCol(freelancerId, workspaceId),
    orderBy('generatedAt', 'desc'),
    firestoreLimit(count)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AIBriefing));
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/hub/briefings.ts
git commit -m "feat(hub): add AI briefing Firestore service"
```

---

### Task 28: Workspace Briefing AI Flow

**Files:**
- Create: `src/ai/schemas/workspace-briefing-schema.ts`
- Create: `src/ai/flows/workspace-briefing.ts`

- [ ] **Step 1: Create briefing Zod schemas**

Define input schema (workspaceId, freelancerId, periodStart ISO string, periodEnd ISO string) and output schema (summary string, actionItems string array, blockers string array) using Zod. Follow existing pattern in `src/ai/schemas/`.

- [ ] **Step 2: Create briefing flow**

Build a Genkit flow `workspaceBriefing` that:
1. Loads AI context via `getAIContext()` (regenerates if null via `generateAIContext()`)
2. Fetches activity events for the period via `listActivityEvents()` with `since` filter
3. Fetches notes via `listNotes()`
4. Constructs a prompt with the context doc as system context, activity events and notes as user context
5. Asks the AI to produce: a summary paragraph, prioritized action items (sorted by urgency), and identified blockers
6. Validates output against the Zod schema
7. Stores result via `storeBriefing()` with `Timestamp.now()` as `generatedAt` and the model name
8. Returns the briefing data

Use `chooseModelBasedOnPrompt()` for model selection. Mark with `'use server'`.

- [ ] **Step 3: Commit**

```bash
git add src/ai/schemas/workspace-briefing-schema.ts src/ai/flows/workspace-briefing.ts
git commit -m "feat(hub): add workspace briefing AI flow"
```

---

### Task 29: Workspace Chat Agent AI Flow

**Files:**
- Create: `src/ai/schemas/workspace-chat-schema.ts`
- Create: `src/ai/flows/workspace-chat-agent.ts`

- [ ] **Step 1: Create chat Zod schemas**

Define input schema (workspaceId, freelancerId, messages array with role/content) and output schema (responseText string).

- [ ] **Step 2: Create chat agent flow**

Build a Genkit flow `workspaceChatAgent` following the `chatWithClientAgent` pattern in `src/ai/flows/client-chat-agent.ts`. Define these tools using `ai.defineTool()`:
- `listActivityEvents` — queries activity events with optional filters
- `getWorkspaceConnections` — lists connected apps
- `getRecentBriefing` — fetches latest briefing
- `listNotes` — reads workspace notes
- `listBookmarks` — reads workspace bookmarks
- `runQACheck` — delegates to `workspaceQAReview` flow (Task 30)
- `draftStatusUpdate` — composes a client-facing status update from recent activity
- `searchActivity` — keyword search across activity titles and body excerpts

System prompt establishes the agent as "Hireverse Workspace Assistant" and injects the AI context doc. Strict instruction: "Never reference or share data from any workspace other than the current one."

- [ ] **Step 3: Commit**

```bash
git add src/ai/schemas/workspace-chat-schema.ts src/ai/flows/workspace-chat-agent.ts
git commit -m "feat(hub): add workspace chat agent AI flow"
```

---

### Task 30: Workspace QA Review AI Flow

**Files:**
- Create: `src/ai/schemas/workspace-qa-review-schema.ts`
- Create: `src/ai/flows/workspace-qa-review.ts`

- [ ] **Step 1: Create QA review Zod schemas**

Define input schema (workspaceId, projectId, submittedWork string, projectBrief string, microtasks array of {description, requiredSkill}) and output schema matching `QAReviewResult` (passed boolean, score number, feedback string, issues array of {severity, description, suggestion}).

- [ ] **Step 2: Create QA review flow**

Build a Genkit flow `workspaceQAReview` that:
1. Loads AI context for the workspace
2. Fetches recent activity from connected systems (last 7 days) for additional context
3. Constructs a prompt asking the AI to review the submitted work against the project brief and microtask descriptions
4. The prompt instructs: score 0-100, list concrete issues with severity levels (low/medium/high/critical) and actionable suggestions, set `passed` to true only if score >= 70 and no critical issues
5. Returns validated `QAReviewResult`

Mark with `'use server'`.

- [ ] **Step 3: Commit**

```bash
git add src/ai/schemas/workspace-qa-review-schema.ts src/ai/flows/workspace-qa-review.ts
git commit -m "feat(hub): add workspace QA review AI flow"
```

---

### Task 31: Workspace Chat API Route (with Auth)

**Files:**
- Create: `src/app/api/hub/chat/route.ts`

- [ ] **Step 1: Create chat API route**

```typescript
// src/app/api/hub/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { workspaceChatAgent } from '@/ai/flows/workspace-chat-agent';
import { verifyAuthToken } from '@/lib/api-auth';

export async function POST(req: NextRequest) {
  try {
    // Auth verification (uses helper from Task 9b)
    const uid = await verifyAuthToken(req);
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId, freelancerId, messages } = await req.json();

    if (!workspaceId || !freelancerId) {
      return NextResponse.json(
        { error: 'workspaceId and freelancerId are required' },
        { status: 400 }
      );
    }
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
    }

    const responseText = await workspaceChatAgent({
      workspaceId,
      freelancerId,
      messages,
    });

    return NextResponse.json({ response: responseText });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/hub/chat/route.ts
git commit -m "feat(hub): add workspace chat API route"
```

---

### Task 32: AI Briefing Panel & Chat UI Components

**Files:**
- Create: `src/components/hub/ai-briefing-panel.tsx`
- Create: `src/components/hub/workspace-chat.tsx`

- [ ] **Step 1: Create AI briefing panel**

Build a component that displays the latest briefing and allows generating new ones. Props: `freelancerId`, `workspaceId`. Shows:
- "Generate Briefing" button (calls `workspaceBriefing()` flow, shows loading spinner)
- Latest briefing: summary paragraph, action items as a numbered list, blockers as a highlighted list with `AlertCircle` icons
- Briefing history: expandable list of past briefings from `listBriefings()`
- Date range selector for custom briefing periods (default: last 7 days)
- Use shadcn `Card`, `Button`, `Badge`, `Accordion`

- [ ] **Step 2: Create workspace chat UI**

Build a chat component following the pattern in `src/components/client-chat-agent.tsx`. Props: `freelancerId`, `workspaceId`. Features:
- Message list with user/assistant bubbles
- Text input with send button
- Posts to `/api/hub/chat` with `workspaceId`, `freelancerId`, and full message history
- Parses the JSON response `{ response: string }` to display the assistant's reply
- Shows typing indicator while waiting for response
- Use shadcn `Card`, `Input`, `Button`, `ScrollArea`

- [ ] **Step 3: Add AI Briefing tab to workspace detail**

Update `src/components/hub/workspace-detail.tsx` to add the "AI Briefing" tab containing both `AIBriefingPanel` and `WorkspaceChat` in a split layout (briefing on top, chat on bottom or side-by-side on larger screens).

- [ ] **Step 4: Commit**

```bash
git add src/components/hub/ai-briefing-panel.tsx src/components/hub/workspace-chat.tsx \
  src/components/hub/workspace-detail.tsx
git commit -m "feat(hub): add AI briefing panel and workspace chat UI"
```

---

## Chunk 5: Phase 4 — Write Actions

Implements write-back actions for each provider via Nango proxy and adds action buttons to the workspace UI.

### Task 33: Slack Write Actions

**Files:**
- Modify: `src/services/integrations/slack.ts`

- [ ] **Step 1: Implement Slack createItem**

Replace the placeholder `createItem`. Supports `type: 'message'`:

```typescript
export async function createItem(
  nangoConnectionId: string,
  payload: CreateItemPayload
): Promise<void> {
  if (payload.type !== 'message') {
    throw new Error(`Unsupported Slack action type: ${payload.type}`);
  }
  if (!payload.metadata?.channel) {
    throw new Error('Channel is required for Slack messages');
  }

  await nango.post({
    endpoint: '/api/chat.postMessage',
    providerConfigKey: config.nangoIntegrationId,
    connectionId: nangoConnectionId,
    data: {
      channel: payload.metadata.channel,
      text: payload.body || payload.title,
    },
    retries: 2,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/integrations/slack.ts
git commit -m "feat(hub): implement Slack write actions via Nango proxy"
```

---

### Task 34: GitHub Write Actions

**Files:**
- Modify: `src/services/integrations/github.ts`

- [ ] **Step 1: Implement GitHub createItem and updateItem**

Replace placeholders:

```typescript
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

  await nango.post({
    endpoint: `/repos/${payload.metadata.repo}/issues`,
    providerConfigKey: config.nangoIntegrationId,
    connectionId: nangoConnectionId,
    data: { title: payload.title, body: payload.body || '' },
    retries: 2,
  });
}

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

  await nango.patch({
    endpoint: `/repos/${payload.updates.repo}/issues/${payload.externalId}`,
    providerConfigKey: config.nangoIntegrationId,
    connectionId: nangoConnectionId,
    data: payload.updates,
    retries: 2,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/integrations/github.ts
git commit -m "feat(hub): implement GitHub write actions via Nango proxy"
```

---

### Task 35: Google Drive Write Actions

**Files:**
- Modify: `src/services/integrations/google-drive.ts`

- [ ] **Step 1: Implement Google Drive createItem**

Replace placeholder. Creates a new Google Doc:

```typescript
export async function createItem(
  nangoConnectionId: string,
  payload: CreateItemPayload
): Promise<void> {
  if (payload.type !== 'file') {
    throw new Error(`Unsupported Google Drive action type: ${payload.type}`);
  }

  // Create file metadata
  await nango.post({
    endpoint: '/drive/v3/files',
    providerConfigKey: config.nangoIntegrationId,
    connectionId: nangoConnectionId,
    data: {
      name: payload.title,
      mimeType: 'application/vnd.google-apps.document',
    },
    retries: 2,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/integrations/google-drive.ts
git commit -m "feat(hub): implement Google Drive write actions via Nango proxy"
```

---

### Task 36: Trello Write Actions

**Files:**
- Modify: `src/services/integrations/trello.ts`

- [ ] **Step 1: Implement Trello createItem and updateItem**

Replace placeholders:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/services/integrations/trello.ts
git commit -m "feat(hub): implement Trello write actions via Nango proxy"
```

---

### Task 37: Notion Write Actions

**Files:**
- Modify: `src/services/integrations/notion.ts`

- [ ] **Step 1: Implement Notion createItem and updateItem**

Replace placeholders:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/services/integrations/notion.ts
git commit -m "feat(hub): implement Notion write actions via Nango proxy"
```

---

### Task 38: Write Action UI

**Files:**
- Modify: `src/components/hub/activity-timeline.tsx`
- Modify: `src/components/hub/workspace-detail.tsx`

- [ ] **Step 1: Add write action buttons to activity timeline**

Update `activity-timeline.tsx` to accept an optional `connections` prop (list of `WorkspaceConnection`). Add action buttons based on context:
- In Tasks view: "Create Issue" button (if GitHub connected), "Create Card" button (if Trello connected)
- In Messages view: "Send Message" button (if Slack connected)
- In Files view: "Create Document" button (if Google Drive connected), "Create Page" button (if Notion connected)
- Each button opens a dialog with a form for title, body, and any required metadata (e.g., channel for Slack, repo for GitHub, listId for Trello, databaseId for Notion)
- On submit, calls the appropriate provider's `createItem()` function with the Nango connection ID from the stored connection
- Permission validation: check that the connection status is `'connected'` before allowing write actions
- Shows success/error toast
- All write actions require a confirmation dialog: "This will create a {type} in {provider}. Continue?"

- [ ] **Step 2: Verify all tabs render with action buttons**

Run: `npm run dev`, navigate to a workspace with connections, verify action buttons appear in the correct tabs.

- [ ] **Step 3: Commit**

```bash
git add src/components/hub/activity-timeline.tsx src/components/hub/workspace-detail.tsx
git commit -m "feat(hub): add write action buttons with confirmation dialogs"
```

---

### Task 39: Environment Variables & README Update

**Files:**
- Modify: `.env.local` (or `.env`)
- Modify: `README.md`

- [ ] **Step 1: Add Nango environment variables**

Add to `.env.local`:

```bash
# Nango — manages OAuth for all hub integrations
NANGO_SECRET_KEY=
NEXT_PUBLIC_NANGO_PUBLIC_KEY=
```

Note: Per-provider OAuth credentials (Slack, GitHub, etc.) are configured directly in the Nango dashboard, not in our env vars.

- [ ] **Step 2: Update README**

Add the Nango environment variables to the Environment Variables section of `README.md`. Add a "Client Systems Hub" section to Pages & Routes documenting the new routes (`/freelancer/hub`, `/freelancer/hub/[workspaceId]`, `/api/hub/nango-session`, `/api/hub/chat`).

- [ ] **Step 3: Verify full dev server startup**

Run: `npm run dev`
Expected: Server starts on port 9002 without errors. `/freelancer/hub` loads. `/freelancer/dashboard` redirects.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add Client Systems Hub routes and env vars to README"
```
