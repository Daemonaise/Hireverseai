# Hub State Refactor, i18n & Message Board — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor hub state management to React Query + Zustand, add i18n (en/es/ru) via next-intl, and build a workspace-scoped message board with AI translation.

**Architecture:** React Query wraps existing Firestore services as custom hooks for caching/deduplication. Zustand handles UI-only state (sidebar, filters, drafts). next-intl with cookie-based locale provides i18n. Message board uses a top-level `workspaceThreads` Firestore collection with AI translation on post via Genkit.

**Tech Stack:** Next.js 15, React 19, TypeScript, @tanstack/react-query (already installed), zustand (new), next-intl (new), Firebase/Firestore, Genkit AI

---

## File Map

### New Files

| File | Responsibility |
|------|----------------|
| `src/components/providers.tsx` | Shared provider wrapper: QueryClientProvider + NextIntlClientProvider + AuthProvider |
| `src/middleware.ts` | next-intl middleware for cookie-based locale negotiation |
| `src/i18n/request.ts` | next-intl getRequestConfig — reads locale from cookie |
| `src/i18n/routing.ts` | Locale list and default: ['en', 'es', 'ru'] |
| `src/messages/en.json` | English UI strings (source of truth) |
| `src/messages/es.json` | Spanish UI strings (AI-generated) |
| `src/messages/ru.json` | Russian UI strings (AI-generated) |
| `src/stores/hub-store.ts` | Zustand store: sidebarOpen, activeFilters, chatDrafts |
| `src/hooks/hub/use-workspace.ts` | useWorkspace, useWorkspaces, useWorkspaceMutations |
| `src/hooks/hub/use-connections.ts` | useConnections, useConnectionMutations |
| `src/hooks/hub/use-activity.ts` | useActivityEvents |
| `src/hooks/hub/use-bookmarks.ts` | useBookmarks, useBookmarkMutations |
| `src/hooks/hub/use-notes.ts` | useNotes, useNoteMutations |
| `src/hooks/hub/use-briefings.ts` | useBriefings, useLatestBriefing |
| `src/hooks/hub/use-messages.ts` | useThreads, useMessages, useMessageMutations |
| `src/ai/schemas/translate-message-schema.ts` | Zod schema for message translation flow |
| `src/ai/schemas/translate-ui-strings-schema.ts` | Zod schema for batch UI string translation flow |
| `src/ai/flows/translate-message.ts` | Genkit flow: translate a single message between locales |
| `src/ai/flows/translate-ui-strings.ts` | Genkit flow: batch translate en.json into target locale |
| `src/services/hub/messages.ts` | Firestore service: threads + messages CRUD with pagination |
| `src/components/messaging/thread-list.tsx` | Shared thread list (left panel) |
| `src/components/messaging/thread-view.tsx` | Shared thread view with compose box |
| `src/components/messaging/message-bubble.tsx` | Single message with translation toggle |
| `src/components/hub/workspace-messages.tsx` | Freelancer Messages tab wrapper |
| `src/components/client-messages.tsx` | Client dashboard Messages section |

### Modified Files

| File | Changes |
|------|---------|
| `src/types/hub.ts` | Add `clientId` to Workspace, add Thread/ThreadMessage/ThreadParticipant types |
| `next.config.ts` | Wrap with `createNextIntlPlugin` for next-intl |
| `src/app/layout.tsx` | Wrap children in `<Providers>`, move Toaster inside |
| `src/app/freelancer/hub/layout.tsx` | Replace hardcoded FREELANCER_ID with useAuth() |
| `src/app/freelancer/hub/page.tsx` | Replace hardcoded FREELANCER_ID with useAuth() |
| `src/app/freelancer/hub/[workspaceId]/page.tsx` | Replace hardcoded FREELANCER_ID with useAuth() |
| `src/components/hub/hub-sidebar.tsx` | Replace useState/useEffect with useWorkspaces(), add i18n |
| `src/components/hub/hub-dashboard.tsx` | Replace useState/useEffect with useWorkspaces()/useWorkspaceMutations(), add clientId to form, add i18n |
| `src/components/hub/workspace-detail.tsx` | Replace fetch with hooks, add Messages tab, rename existing Messages tab to "App Messages", add i18n |
| `src/components/hub/workspace-card.tsx` | Replace useState/useEffect with useActivityEvents(), add i18n |
| `src/components/hub/activity-timeline.tsx` | Replace fetch with useActivityEvents(), add useConnections() internally, use Zustand for filters, add i18n |
| `src/components/hub/bookmark-list.tsx` | Replace fetch with useBookmarks()/useBookmarkMutations(), add i18n |
| `src/components/hub/note-editor.tsx` | Replace fetch with useNotes()/useNoteMutations(), remove ref hack, add i18n |
| `src/components/hub/access-permissions.tsx` | Replace fetch with useConnections()/useActivityEvents(), add i18n |
| `src/components/hub/ai-briefing-panel.tsx` | Replace fetch with useLatestBriefing()/useBriefings(), add i18n |
| `src/components/hub/workspace-chat.tsx` | Add i18n |
| `src/components/hub/connection-setup-dialog.tsx` | Add i18n |
| `src/components/hub/connection-tile.tsx` | Add i18n |
| `src/components/header-navigation-client.tsx` | Add locale switcher dropdown |
| `src/components/client-dashboard.tsx` | Add Messages section |
| `src/services/hub/workspaces.ts` | Accept optional clientId in createWorkspace |

### Removed Dependencies

| Package | Reason |
|---------|--------|
| `@tanstack-query-firebase/react` | Not used — we wrap Firestore services with plain useQuery/useMutation |

---

## Chunk 1: Foundation — Dependencies, Types, Providers, Zustand Store

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install zustand and next-intl**

```bash
cd /home/user/studio && npm install zustand next-intl
```

- [ ] **Step 2: Remove unused @tanstack-query-firebase/react**

```bash
npm uninstall @tanstack-query-firebase/react
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add zustand + next-intl, remove unused tanstack-query-firebase"
```

---

### Task 2: Add messaging types and clientId to Workspace

**Files:**
- Modify: `src/types/hub.ts`

- [ ] **Step 1: Add clientId to Workspace interface**

After the existing `clientName: string;` line in the Workspace interface, add:

```typescript
clientId?: string; // references clients/{cid} — optional until migration
```

- [ ] **Step 2: Add Thread, ThreadMessage, ThreadParticipant, and input types**

At the end of `src/types/hub.ts`, add:

```typescript
// --- Messaging ---

export interface ThreadParticipant {
  id: string;
  role: 'freelancer' | 'client';
  locale: string;
}

export interface Thread {
  id: string;
  subject: string;
  workspaceId: string;
  freelancerId: string;
  clientId: string;
  participants: ThreadParticipant[];
  lastMessageAt: Timestamp;
  createdAt: Timestamp;
  createdBy: string;
}

export interface ThreadMessage {
  id: string;
  authorId: string;
  authorRole: 'freelancer' | 'client';
  originalText: string;
  originalLocale: string;
  translations: Partial<Record<'en' | 'es' | 'ru', string>>;
  createdAt: Timestamp;
}

export interface CreateThreadInput {
  workspaceId: string;
  freelancerId: string;
  clientId: string;
  subject: string;
}

export interface PostMessageInput {
  authorId: string;
  authorRole: 'freelancer' | 'client';
  text: string;
  locale: string;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/types/hub.ts
git commit -m "feat(hub): add messaging types and clientId to Workspace"
```

---

### Task 3: Create Zustand store

**Files:**
- Create: `src/stores/hub-store.ts`

- [ ] **Step 1: Create the hub store**

```typescript
import { create } from 'zustand';

interface HubStore {
  sidebarOpen: boolean;
  activeFilters: { provider?: string; sourceType?: string };
  chatDrafts: Record<string, string>;
  toggleSidebar: () => void;
  setFilter: (key: string, value: string | undefined) => void;
  clearFilters: () => void;
  setChatDraft: (workspaceId: string, text: string) => void;
}

export const useHubStore = create<HubStore>((set) => ({
  sidebarOpen: true,
  activeFilters: {},
  chatDrafts: {},
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setFilter: (key, value) =>
    set((s) => ({
      activeFilters: { ...s.activeFilters, [key]: value },
    })),
  clearFilters: () => set({ activeFilters: {} }),
  setChatDraft: (workspaceId, text) =>
    set((s) => ({
      chatDrafts: { ...s.chatDrafts, [workspaceId]: text },
    })),
}));
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/stores/hub-store.ts
git commit -m "feat(hub): add Zustand UI state store"
```

---

### Task 4: Create i18n config, middleware, and English strings

**Files:**
- Create: `src/i18n/request.ts`
- Create: `src/i18n/routing.ts`
- Create: `src/middleware.ts`
- Create: `src/messages/en.json`

- [ ] **Step 1: Create routing config**

`src/i18n/routing.ts`:
```typescript
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'es', 'ru'],
  defaultLocale: 'en',
  localePrefix: 'never', // cookie-based only, no /es/ or /ru/ path prefixes
});
```

- [ ] **Step 2: Create request config**

`src/i18n/request.ts`:
```typescript
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as 'en' | 'es' | 'ru')) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

- [ ] **Step 3: Create middleware**

`src/middleware.ts`:
```typescript
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
```

- [ ] **Step 4: Create English strings source file**

`src/messages/en.json`:
```json
{
  "common": {
    "loading": "Loading...",
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "create": "Create",
    "close": "Close",
    "confirm": "Confirm",
    "search": "Search",
    "noResults": "No results found",
    "error": "Something went wrong",
    "retry": "Retry",
    "showOriginal": "Show original",
    "showTranslation": "Show translation"
  },
  "hub": {
    "title": "Client Systems Hub",
    "newWorkspace": "New Workspace",
    "noWorkspaces": "No workspaces yet. Create one to get started.",
    "workspaceName": "Workspace Name",
    "clientName": "Client Name",
    "engagementType": "Engagement Type",
    "createWorkspace": "Create Workspace",
    "active": "Active",
    "archived": "Archived",
    "overview": "Overview",
    "apps": "Apps",
    "notes": "Notes",
    "tasks": "Tasks",
    "appMessages": "App Messages",
    "messages": "Messages",
    "files": "Files",
    "timeline": "Timeline",
    "aiBriefing": "AI Briefing",
    "accessPermissions": "Access & Permissions",
    "backToHub": "Back to Hub",
    "workspaceNotFound": "Workspace not found"
  },
  "sidebar": {
    "newWorkspace": "New Workspace",
    "archived": "Archived",
    "noWorkspaces": "No workspaces"
  },
  "connections": {
    "addConnection": "Add Connection",
    "noConnections": "No integrations connected yet.",
    "connectIntegration": "Connect an integration to get started.",
    "launch": "Launch",
    "disconnect": "Disconnect",
    "confirmDisconnect": "Confirm",
    "cancelDisconnect": "Cancel",
    "connected": "Connected",
    "disconnected": "Disconnected",
    "error": "Error",
    "selectProvider": "Select an integration to connect",
    "connecting": "Connecting..."
  },
  "bookmarks": {
    "title": "Bookmarks",
    "addBookmark": "Add Bookmark",
    "noBookmarks": "No bookmarks yet.",
    "titleField": "Title",
    "urlField": "URL",
    "descriptionField": "Description (optional)"
  },
  "notes": {
    "newNote": "New Note",
    "noNotes": "No notes yet. Create one to get started.",
    "untitled": "Untitled Note",
    "titlePlaceholder": "Note title...",
    "contentPlaceholder": "Start writing..."
  },
  "activity": {
    "syncNow": "Sync Now",
    "syncing": "Syncing...",
    "allProviders": "All Providers",
    "allTypes": "All Types",
    "noActivity": "No activity yet. Connect an integration and sync to see activity here.",
    "task": "Task",
    "message": "Message",
    "document": "Document",
    "ticket": "Ticket",
    "repositoryEvent": "Repository Event",
    "connectionEvent": "Connection Event"
  },
  "briefing": {
    "title": "AI Briefing",
    "generate": "Generate Briefing",
    "generating": "Generating...",
    "from": "From",
    "to": "To",
    "summary": "Summary",
    "actionItems": "Action Items",
    "blockers": "Blockers",
    "history": "Briefing History",
    "noBriefing": "No briefing generated yet.",
    "noHistory": "No briefing history."
  },
  "chat": {
    "placeholder": "Ask about this workspace...",
    "send": "Send",
    "error": "Failed to send message. Please try again."
  },
  "permissions": {
    "description": "These integrations have access to this workspace. Revoking access removes the connection from this workspace only.",
    "noConnections": "No connected integrations",
    "connectPrompt": "Connect an integration from the Integrations tab.",
    "revokeAccess": "Revoke",
    "revokeTitle": "Revoke {provider} access?",
    "revokeDescription": "This will remove the {provider} connection from this workspace. You can reconnect it at any time from the Integrations tab.",
    "auditLog": "Connection Audit Log",
    "connectedSince": "Connected since {date}"
  },
  "messaging": {
    "newThread": "New Thread",
    "subject": "Subject",
    "noThreads": "No messages yet. Start a conversation.",
    "noMessages": "No messages in this thread.",
    "composePlaceholder": "Type a message...",
    "send": "Send",
    "retryTranslation": "Retry translation",
    "you": "You",
    "client": "Client",
    "freelancer": "Freelancer"
  },
  "locale": {
    "switchLanguage": "Language",
    "en": "English",
    "es": "Español",
    "ru": "Русский"
  }
}
```

- [ ] **Step 5: Update next.config.ts with next-intl plugin**

Read `next.config.ts`. Wrap the existing config with `createNextIntlPlugin`:

```typescript
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// ... existing config ...

export default withNextIntl(nextConfig);
```

- [ ] **Step 6: Create stub es.json and ru.json**

Copy `en.json` as temporary stubs so the app doesn't crash if locale cookie is set before translations are generated in Task 19:

```bash
cp src/messages/en.json src/messages/es.json
cp src/messages/en.json src/messages/ru.json
```

- [ ] **Step 7: Verify dev server starts**

```bash
npm run dev
```

- [ ] **Step 8: Commit**

```bash
git add src/i18n/ src/middleware.ts src/messages/ next.config.ts
git commit -m "feat(i18n): add next-intl config, middleware, English strings, and next.config plugin"
```

---

### Task 5: Create providers wrapper and update root layout

**Files:**
- Create: `src/components/providers.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create providers wrapper**

`src/components/providers.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { AuthProvider } from '@/contexts/auth-context';
import type { AbstractIntlMessages } from 'next-intl';

interface ProvidersProps {
  children: React.ReactNode;
  locale: string;
  messages: AbstractIntlMessages;
}

export function Providers({ children, locale, messages }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000, // 30s before refetch
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        <AuthProvider>{children}</AuthProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 2: Update root layout to use Providers**

Modify `src/app/layout.tsx` to import and wrap with Providers. The layout becomes an async server component that loads locale + messages:

```typescript
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { Providers } from '@/components/providers';
import { getLocale, getMessages } from 'next-intl/server';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Hireverse AI',
  description: 'AI Hiring Solutions Built for Speed and Precision',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers locale={locale} messages={messages}>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify dev server starts**

```bash
npm run dev
```

Check that http://localhost:9002 loads without errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/providers.tsx src/app/layout.tsx
git commit -m "feat: add shared Providers wrapper with React Query, next-intl, and Auth"
```

---

### Task 6: Replace hardcoded FREELANCER_ID with useAuth()

> **Dependency:** Task 5 must be completed first — `useAuth()` requires `AuthProvider` which is mounted in the new `Providers` wrapper.

**Files:**
- Modify: `src/app/freelancer/hub/layout.tsx`
- Modify: `src/app/freelancer/hub/page.tsx`
- Modify: `src/app/freelancer/hub/[workspaceId]/page.tsx`

- [ ] **Step 1: Update hub layout**

Replace the hardcoded ID with auth context. Read the current file first, then replace the FREELANCER_ID constant and its usage:

```typescript
'use client';

import { useAuth } from '@/contexts/auth-context';
import { HubSidebar } from '@/components/hub/hub-sidebar';
import { Loader2 } from 'lucide-react';

export default function HubLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Please log in to access the hub.</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <HubSidebar freelancerId={user.uid} />
      <main className="flex-1 overflow-auto bg-gray-50">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Update hub page**

```typescript
'use client';

import { useAuth } from '@/contexts/auth-context';
import { HubDashboard } from '@/components/hub/hub-dashboard';
import { Loader2 } from 'lucide-react';

export default function HubPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

  return <HubDashboard freelancerId={user.uid} />;
}
```

- [ ] **Step 3: Update workspace detail page**

```typescript
'use client';

import { use } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { WorkspaceDetail } from '@/components/hub/workspace-detail';
import { Loader2 } from 'lucide-react';

export default function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

  return <WorkspaceDetail freelancerId={user.uid} workspaceId={workspaceId} />;
}
```

- [ ] **Step 4: Verify dev server starts**

```bash
npm run dev
```

- [ ] **Step 5: Commit**

```bash
git add src/app/freelancer/hub/layout.tsx src/app/freelancer/hub/page.tsx src/app/freelancer/hub/\\[workspaceId\\]/page.tsx
git commit -m "fix(hub): replace hardcoded FREELANCER_ID with useAuth()"
```

---

## Chunk 2: React Query Hooks

### Task 7: Create workspace hooks

**Files:**
- Create: `src/hooks/hub/use-workspace.ts`

- [ ] **Step 1: Create the hooks file**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getWorkspace,
  listWorkspaces,
  createWorkspace,
  updateWorkspace,
  archiveWorkspace,
} from '@/services/hub/workspaces';
import type { Workspace, WorkspaceStatus } from '@/types/hub';

export function useWorkspace(freelancerId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['workspace', freelancerId, workspaceId],
    queryFn: () => getWorkspace(freelancerId, workspaceId),
    enabled: !!freelancerId && !!workspaceId,
  });
}

export function useWorkspaces(freelancerId: string, status?: WorkspaceStatus) {
  return useQuery({
    queryKey: ['workspaces', freelancerId, status],
    queryFn: () => listWorkspaces(freelancerId, status),
    enabled: !!freelancerId,
  });
}

export function useWorkspaceMutations(freelancerId: string) {
  const queryClient = useQueryClient();
  const baseKey = ['workspaces', freelancerId];

  const create = useMutation({
    mutationFn: (data: {
      name: string;
      clientName: string;
      engagementType: string;
      clientId?: string;
    }) =>
      createWorkspace(freelancerId, {
        ...data,
        status: 'active' as const,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: baseKey }),
  });

  const update = useMutation({
    mutationFn: ({
      workspaceId,
      data,
    }: {
      workspaceId: string;
      data: Partial<Pick<Workspace, 'name' | 'clientName' | 'engagementType' | 'status'>>;
    }) => updateWorkspace(freelancerId, workspaceId, data),
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: baseKey });
      queryClient.invalidateQueries({
        queryKey: ['workspace', freelancerId, workspaceId],
      });
    },
  });

  const archive = useMutation({
    mutationFn: (workspaceId: string) =>
      archiveWorkspace(freelancerId, workspaceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: baseKey }),
  });

  return { create, update, archive };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/hub/use-workspace.ts
git commit -m "feat(hub): add React Query hooks for workspaces"
```

---

### Task 8: Create connection hooks

**Files:**
- Create: `src/hooks/hub/use-connections.ts`

- [ ] **Step 1: Create the hooks file**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listConnections,
  createConnection,
  deleteConnection,
  updateConnectionStatus,
} from '@/services/hub/connections';
import type { WorkspaceConnection, ProviderId, ConnectionStatus } from '@/types/hub';

export function useConnections(freelancerId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['connections', freelancerId, workspaceId],
    queryFn: () => listConnections(freelancerId, workspaceId),
    enabled: !!freelancerId && !!workspaceId,
  });
}

export function useConnectionMutations(
  freelancerId: string,
  workspaceId: string
) {
  const queryClient = useQueryClient();
  const key = ['connections', freelancerId, workspaceId];

  const create = useMutation({
    mutationFn: (data: {
      provider: ProviderId;
      nangoConnectionId: string;
      nangoIntegrationId: string;
      label: string;
      launchUrl: string;
    }) =>
      createConnection(
        freelancerId,
        workspaceId,
        data.provider,
        data.nangoConnectionId,
        data.nangoIntegrationId,
        data.label,
        data.launchUrl
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    mutationFn: ({
      connectionId,
      provider,
      label,
    }: {
      connectionId: string;
      provider: ProviderId;
      label: string;
    }) => deleteConnection(freelancerId, workspaceId, connectionId, provider, label),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const updateStatus = useMutation({
    mutationFn: ({
      connectionId,
      status,
    }: {
      connectionId: string;
      status: ConnectionStatus;
    }) => updateConnectionStatus(freelancerId, workspaceId, connectionId, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return { create, remove, updateStatus };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/hub/use-connections.ts
git commit -m "feat(hub): add React Query hooks for connections"
```

---

### Task 9: Create activity, bookmark, note, and briefing hooks

**Files:**
- Create: `src/hooks/hub/use-activity.ts`
- Create: `src/hooks/hub/use-bookmarks.ts`
- Create: `src/hooks/hub/use-notes.ts`
- Create: `src/hooks/hub/use-briefings.ts`

- [ ] **Step 1: Create activity hooks**

`src/hooks/hub/use-activity.ts`:
```typescript
import { useQuery } from '@tanstack/react-query';
import { listActivityEvents } from '@/services/hub/activity';
import type { ProviderId, ActivitySourceType } from '@/types/hub';

interface ActivityFilters {
  provider?: ProviderId;
  sourceType?: ActivitySourceType;
  since?: Date;
  limit?: number;
}

export function useActivityEvents(
  freelancerId: string,
  workspaceId: string,
  filters?: ActivityFilters
) {
  return useQuery({
    queryKey: ['activity', freelancerId, workspaceId, filters],
    queryFn: () => listActivityEvents(freelancerId, workspaceId, filters),
    enabled: !!freelancerId && !!workspaceId,
  });
}
```

- [ ] **Step 2: Create bookmark hooks**

`src/hooks/hub/use-bookmarks.ts`:
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listBookmarks,
  addBookmark,
  deleteBookmark,
} from '@/services/hub/bookmarks';

export function useBookmarks(freelancerId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['bookmarks', freelancerId, workspaceId],
    queryFn: () => listBookmarks(freelancerId, workspaceId),
    enabled: !!freelancerId && !!workspaceId,
  });
}

export function useBookmarkMutations(
  freelancerId: string,
  workspaceId: string
) {
  const queryClient = useQueryClient();
  const key = ['bookmarks', freelancerId, workspaceId];

  const add = useMutation({
    mutationFn: (data: { title: string; url: string; description: string }) =>
      addBookmark(freelancerId, workspaceId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    mutationFn: (bookmarkId: string) =>
      deleteBookmark(freelancerId, workspaceId, bookmarkId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return { add, remove };
}
```

- [ ] **Step 3: Create note hooks**

`src/hooks/hub/use-notes.ts`:
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listNotes,
  addNote,
  updateNote,
  deleteNote,
} from '@/services/hub/notes';

export function useNotes(freelancerId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['notes', freelancerId, workspaceId],
    queryFn: () => listNotes(freelancerId, workspaceId),
    enabled: !!freelancerId && !!workspaceId,
  });
}

export function useNoteMutations(freelancerId: string, workspaceId: string) {
  const queryClient = useQueryClient();
  const key = ['notes', freelancerId, workspaceId];

  const create = useMutation({
    mutationFn: (data: { title: string; content: string }) =>
      addNote(freelancerId, workspaceId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const update = useMutation({
    mutationFn: ({
      noteId,
      data,
    }: {
      noteId: string;
      data: { title?: string; content?: string };
    }) => updateNote(freelancerId, workspaceId, noteId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    mutationFn: (noteId: string) =>
      deleteNote(freelancerId, workspaceId, noteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return { create, update, remove };
}
```

- [ ] **Step 4: Create briefing hooks**

`src/hooks/hub/use-briefings.ts`:
```typescript
import { useQuery } from '@tanstack/react-query';
import {
  getLatestBriefing,
  listBriefings,
} from '@/services/hub/briefings';

export function useLatestBriefing(freelancerId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['briefing-latest', freelancerId, workspaceId],
    queryFn: () => getLatestBriefing(freelancerId, workspaceId),
    enabled: !!freelancerId && !!workspaceId,
  });
}

export function useBriefings(freelancerId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['briefings', freelancerId, workspaceId],
    queryFn: () => listBriefings(freelancerId, workspaceId),
    enabled: !!freelancerId && !!workspaceId,
  });
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/hooks/hub/use-activity.ts src/hooks/hub/use-bookmarks.ts src/hooks/hub/use-notes.ts src/hooks/hub/use-briefings.ts
git commit -m "feat(hub): add React Query hooks for activity, bookmarks, notes, briefings"
```

---

## Chunk 3: Component Refactor — Replace useState/useEffect with Hooks

### Task 10: Refactor hub-sidebar to use React Query

**Files:**
- Modify: `src/components/hub/hub-sidebar.tsx`

- [ ] **Step 1: Replace useState/useEffect with useWorkspaces**

Read the current file. Replace the `workspaces` state + `useEffect` fetch with:

```typescript
import { useWorkspaces } from '@/hooks/hub/use-workspace';
import { useTranslations } from 'next-intl';
```

Remove:
- `useState<Workspace[]>([])` for workspaces
- The `useEffect` that calls `listWorkspaces`
- The import of `listWorkspaces` from services

Replace with:
```typescript
const { data: workspaces = [] } = useWorkspaces(freelancerId);
const t = useTranslations('sidebar');
```

Replace hardcoded strings with `t()` calls:
- `"New Workspace"` → `{t('newWorkspace')}`
- `"Archived"` → `{t('archived')}`

- [ ] **Step 2: Verify dev server renders sidebar**

```bash
npm run dev
```

- [ ] **Step 3: Commit**

```bash
git add src/components/hub/hub-sidebar.tsx
git commit -m "refactor(hub): migrate hub-sidebar to React Query + i18n"
```

---

### Task 11: Refactor hub-dashboard to use React Query

**Files:**
- Modify: `src/components/hub/hub-dashboard.tsx`

- [ ] **Step 1: Replace fetch + create patterns**

Read the current file. Replace:

```typescript
import { useWorkspaces, useWorkspaceMutations } from '@/hooks/hub/use-workspace';
import { useTranslations } from 'next-intl';
```

Remove:
- `useState<Workspace[]>([])` for workspaces
- `useState(true)` for loading
- The `useEffect` that calls `listWorkspaces`
- The `handleCreate` function body that calls `createWorkspace` then refetches

Replace with:
```typescript
const { data: workspaces = [], isLoading: loading } = useWorkspaces(freelancerId);
const { create } = useWorkspaceMutations(freelancerId);
const t = useTranslations('hub');
```

Update `handleCreate` to:
```typescript
async function handleCreate() {
  setSubmitting(true);
  try {
    await create.mutateAsync({ name, clientName, engagementType });
    setDialogOpen(false);
    setName('');
    setClientName('');
    setEngagementType('');
  } finally {
    setSubmitting(false);
  }
}
```

Replace hardcoded strings with `t()` calls.

- [ ] **Step 2: Verify dev server renders dashboard**

```bash
npm run dev
```

- [ ] **Step 3: Commit**

```bash
git add src/components/hub/hub-dashboard.tsx
git commit -m "refactor(hub): migrate hub-dashboard to React Query + i18n"
```

---

### Task 12: Refactor workspace-detail to use React Query

**Files:**
- Modify: `src/components/hub/workspace-detail.tsx`

- [ ] **Step 1: Replace fetch patterns**

Read the current file. Replace workspace + connections fetching:

```typescript
import { useWorkspace } from '@/hooks/hub/use-workspace';
import { useConnections, useConnectionMutations } from '@/hooks/hub/use-connections';
import { useTranslations } from 'next-intl';
```

Remove:
- `useState` for workspace, connections, loading
- `useCallback` for fetchData
- `useEffect` that calls fetchData
- The `handleConnectionCreated` callback that refetches
- The `handleDeleteConnection` callback
- Imports of `getWorkspace`, `listConnections`, `deleteConnection` from services

Replace with:
```typescript
const { data: workspace, isLoading: loadingWorkspace } = useWorkspace(freelancerId, workspaceId);
const { data: connections = [] } = useConnections(freelancerId, workspaceId);
const { remove: removeConnection } = useConnectionMutations(freelancerId, workspaceId);
const t = useTranslations('hub');

const loading = loadingWorkspace;
```

Update delete handler:
```typescript
async function handleDeleteConnection(connectionId: string) {
  const conn = connections.find((c) => c.id === connectionId);
  if (conn) {
    await removeConnection.mutateAsync({
      connectionId,
      provider: conn.provider,
      label: conn.label,
    });
  }
}
```

Remove `connections` prop from `ActivityTimeline` — it will fetch its own via `useConnections()`.

Rename the existing "Messages" tab: change `value="messages"` to `value="app-messages"` and the trigger text to `{t('appMessages')}`. Add a new tab with `value="messages"` and trigger text `{t('messages')}` for the message board (placeholder for now — component built in Chunk 5).

Replace hardcoded strings with `t()` calls.

- [ ] **Step 2: Verify dev server renders workspace detail**

```bash
npm run dev
```

- [ ] **Step 3: Commit**

```bash
git add src/components/hub/workspace-detail.tsx
git commit -m "refactor(hub): migrate workspace-detail to React Query + i18n"
```

---

### Task 13: Refactor workspace-card to use React Query

**Files:**
- Modify: `src/components/hub/workspace-card.tsx`

- [ ] **Step 1: Replace fetch patterns**

Read the current file. Replace the `useState` + `useEffect` for unread count and deadline:

```typescript
import { useActivityEvents } from '@/hooks/hub/use-activity';
import { useTranslations } from 'next-intl';
```

Remove:
- `useState` for unreadCount and nextDeadline
- `useEffect` that fetches activity events
- Import of `listActivityEvents`

Replace with two separate queries matching the existing fetch pattern:
```typescript
const { data: unreadActivity = [] } = useActivityEvents(freelancerId, workspace.id, {
  since: workspace.lastVisitedAt?.toDate() ?? undefined,
  limit: 100,
});
const { data: deadlineActivity = [] } = useActivityEvents(freelancerId, workspace.id, {
  limit: 50,
});
const t = useTranslations('hub');

const unreadCount = unreadActivity.length;
const nextDeadline = deadlineActivity
  .filter((e) => e.dueDate)
  .sort((a, b) => a.dueDate!.toMillis() - b.dueDate!.toMillis())
  .find((e) => e.dueDate!.toDate() > new Date())?.dueDate ?? null;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/hub/workspace-card.tsx
git commit -m "refactor(hub): migrate workspace-card to React Query + i18n"
```

---

### Task 14: Refactor activity-timeline to use React Query + Zustand

**Files:**
- Modify: `src/components/hub/activity-timeline.tsx`

- [ ] **Step 1: Replace fetch and filter patterns**

Read the current file. This is the most complex refactor. Replace:

```typescript
import { useActivityEvents } from '@/hooks/hub/use-activity';
import { useConnections } from '@/hooks/hub/use-connections';
import { useHubStore } from '@/stores/hub-store';
import { useTranslations } from 'next-intl';
```

Remove:
- `useState` for events, loading, filter state
- `useCallback` for fetchEvents
- `useEffect` that fetches events
- The `connections` prop from the interface — component now fetches its own

Replace filter state with Zustand:
```typescript
const { activeFilters, setFilter } = useHubStore();
const providerFilter = activeFilters.provider;
const sourceTypeFilter = filterSourceType || activeFilters.sourceType;
```

Replace event fetching with React Query:
```typescript
const { data: events = [], isLoading: loading, refetch } = useActivityEvents(
  freelancerId,
  workspaceId,
  {
    provider: providerFilter,
    sourceType: sourceTypeFilter,
  }
);
const { data: connections = [] } = useConnections(freelancerId, workspaceId);
```

Update sync handler to use `refetch()` after sync completes.

**Important:** Update all internal references from the old `connections` prop to the query data:
- `getVisibleActions()` — change from using the prop to using `connections` from `useConnections()`
- `handleConfirmedSubmit()` — change `connections.find(...)` to use the query data variable
- Remove `connections?: WorkspaceConnection[]` from the props interface entirely

Replace hardcoded strings with `t()` calls.

- [ ] **Step 2: Verify dev server renders timeline**

```bash
npm run dev
```

- [ ] **Step 3: Commit**

```bash
git add src/components/hub/activity-timeline.tsx
git commit -m "refactor(hub): migrate activity-timeline to React Query + Zustand + i18n"
```

---

### Task 15: Refactor bookmark-list, note-editor, access-permissions

**Files:**
- Modify: `src/components/hub/bookmark-list.tsx`
- Modify: `src/components/hub/note-editor.tsx`
- Modify: `src/components/hub/access-permissions.tsx`

- [ ] **Step 1: Refactor bookmark-list**

Read the current file. Replace:

```typescript
import { useBookmarks, useBookmarkMutations } from '@/hooks/hub/use-bookmarks';
import { useTranslations } from 'next-intl';
```

Remove `useState`/`useEffect` for bookmarks, replace with:
```typescript
const { data: bookmarks = [], isLoading: loading } = useBookmarks(freelancerId, workspaceId);
const { add, remove } = useBookmarkMutations(freelancerId, workspaceId);
const t = useTranslations('bookmarks');
```

Update add/delete handlers to use `add.mutateAsync()` / `remove.mutateAsync()`.

- [ ] **Step 2: Refactor note-editor**

Read the current file. Replace:

```typescript
import { useNotes, useNoteMutations } from '@/hooks/hub/use-notes';
import { useTranslations } from 'next-intl';
```

Remove:
- `useState`/`useEffect`/`useCallback` for notes
- `useRef(false)` initialized hack
- The `refreshNotes` callback

Replace with:
```typescript
const { data: notes = [], isLoading: loading } = useNotes(freelancerId, workspaceId);
const { create, update, remove } = useNoteMutations(freelancerId, workspaceId);
const t = useTranslations('notes');
```

Use `useEffect` only to auto-select first note when `notes` data changes and no note is selected.

- [ ] **Step 3: Refactor access-permissions**

Read the current file. Replace:

```typescript
import { useConnections, useConnectionMutations } from '@/hooks/hub/use-connections';
import { useActivityEvents } from '@/hooks/hub/use-activity';
import { useTranslations } from 'next-intl';
```

Remove `useState`/`useEffect` for connections and audit events. Replace with:
```typescript
const { data: connections = [], isLoading: loading } = useConnections(freelancerId, workspaceId);
const { data: auditEvents = [] } = useActivityEvents(freelancerId, workspaceId, {
  sourceType: 'connection_event',
});
const { remove } = useConnectionMutations(freelancerId, workspaceId);
const t = useTranslations('permissions');
```

- [ ] **Step 4: Verify all three components render**

```bash
npm run dev
```

- [ ] **Step 5: Commit**

```bash
git add src/components/hub/bookmark-list.tsx src/components/hub/note-editor.tsx src/components/hub/access-permissions.tsx
git commit -m "refactor(hub): migrate bookmark-list, note-editor, access-permissions to React Query + i18n"
```

---

### Task 16: Refactor ai-briefing-panel, workspace-chat, connection components + locale switcher

**Files:**
- Modify: `src/components/hub/ai-briefing-panel.tsx`
- Modify: `src/components/hub/workspace-chat.tsx`
- Modify: `src/components/hub/connection-setup-dialog.tsx`
- Modify: `src/components/hub/connection-tile.tsx`
- Modify: `src/components/header-navigation-client.tsx`

- [ ] **Step 1: Refactor ai-briefing-panel**

Read the current file. Replace briefing fetch:

```typescript
import { useLatestBriefing, useBriefings } from '@/hooks/hub/use-briefings';
import { useTranslations } from 'next-intl';
```

Remove `useState`/`useEffect` for briefing and history. Replace with:
```typescript
const { data: briefing } = useLatestBriefing(freelancerId, workspaceId);
const { data: history = [] } = useBriefings(freelancerId, workspaceId);
const t = useTranslations('briefing');
```

Keep the `generate` handler — it calls the AI flow directly and then invalidates the query:
```typescript
const queryClient = useQueryClient();
// ... after generate:
queryClient.invalidateQueries({ queryKey: ['briefing-latest', freelancerId, workspaceId] });
queryClient.invalidateQueries({ queryKey: ['briefings', freelancerId, workspaceId] });
```

- [ ] **Step 2: Add i18n to workspace-chat**

Read the current file. Add:
```typescript
import { useTranslations } from 'next-intl';
const t = useTranslations('chat');
```

Replace hardcoded placeholder and error strings with `t()` calls. No state management changes needed (chat manages its own local message array — this is intentional since it's ephemeral client-side state).

- [ ] **Step 3: Add i18n to connection-setup-dialog and connection-tile**

For each file, add `useTranslations('connections')` and replace hardcoded strings.

- [ ] **Step 4: Add locale switcher to header navigation**

Read `src/components/header-navigation-client.tsx`. Add a locale dropdown:

```typescript
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe } from 'lucide-react';

// Inside the component:
const locale = useLocale();
const router = useRouter();
const pathname = usePathname();
const t = useTranslations('locale');

function switchLocale(newLocale: string) {
  document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000`;
  router.refresh();
}

// In the JSX, add before the auth buttons:
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
      <Globe className="h-4 w-4 mr-1" />
      {t(locale)}
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={() => switchLocale('en')}>
      {t('en')}
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => switchLocale('es')}>
      {t('es')}
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => switchLocale('ru')}>
      {t('ru')}
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

- [ ] **Step 5: Verify all components render**

```bash
npm run dev
```

- [ ] **Step 6: Commit**

```bash
git add src/components/hub/ai-briefing-panel.tsx src/components/hub/workspace-chat.tsx src/components/hub/connection-setup-dialog.tsx src/components/hub/connection-tile.tsx src/components/header-navigation-client.tsx
git commit -m "refactor(hub): migrate briefing panel, chat, connections to i18n + add locale switcher"
```

---

## Chunk 4: AI Translation Flows + i18n Generation

### Task 17: Create translation Zod schemas

**Files:**
- Create: `src/ai/schemas/translate-message-schema.ts`
- Create: `src/ai/schemas/translate-ui-strings-schema.ts`

- [ ] **Step 1: Create message translation schema**

`src/ai/schemas/translate-message-schema.ts`:
```typescript
import { z } from 'zod';

export const TranslateMessageInputSchema = z.object({
  text: z.string().describe('The message text to translate'),
  sourceLocale: z.string().describe('Source language code (en, es, ru)'),
  targetLocale: z.string().describe('Target language code (en, es, ru)'),
});

export const TranslateMessageOutputSchema = z.object({
  translatedText: z.string().describe('The translated message text'),
});

export type TranslateMessageInput = z.infer<typeof TranslateMessageInputSchema>;
export type TranslateMessageOutput = z.infer<typeof TranslateMessageOutputSchema>;
```

- [ ] **Step 2: Create UI strings translation schema**

`src/ai/schemas/translate-ui-strings-schema.ts`:
```typescript
import { z } from 'zod';

export const TranslateUiStringsInputSchema = z.object({
  sourceStrings: z.record(z.string()).describe('Flat key-value map of English UI strings'),
  targetLocale: z.string().describe('Target language code (es, ru)'),
});

export const TranslateUiStringsOutputSchema = z.object({
  translatedStrings: z.record(z.string()).describe('Flat key-value map of translated UI strings'),
});

export type TranslateUiStringsInput = z.infer<typeof TranslateUiStringsInputSchema>;
export type TranslateUiStringsOutput = z.infer<typeof TranslateUiStringsOutputSchema>;
```

- [ ] **Step 3: Commit**

```bash
git add src/ai/schemas/translate-message-schema.ts src/ai/schemas/translate-ui-strings-schema.ts
git commit -m "feat(ai): add Zod schemas for translation flows"
```

---

### Task 18: Create translate-message Genkit flow

**Files:**
- Create: `src/ai/flows/translate-message.ts`

- [ ] **Step 1: Create the flow**

```typescript
'use server';

import { ai } from '@/lib/ai';
import {
  TranslateMessageInputSchema,
  TranslateMessageOutputSchema,
} from '@/ai/schemas/translate-message-schema';

const LOCALE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  ru: 'Russian',
};

export const translateMessage = ai.defineFlow(
  {
    name: 'translateMessage',
    inputSchema: TranslateMessageInputSchema,
    outputSchema: TranslateMessageOutputSchema,
  },
  async (input) => {
    const sourceName = LOCALE_NAMES[input.sourceLocale] || input.sourceLocale;
    const targetName = LOCALE_NAMES[input.targetLocale] || input.targetLocale;

    const { text: translatedText } = await ai.generate({
      model: 'googleai/gemini-2.0-flash',
      prompt: `Translate the following message from ${sourceName} to ${targetName}.
Preserve the original tone, formatting, and any technical terms.
Return ONLY the translated text, nothing else.

Message:
${input.text}`,
    });

    return { translatedText: translatedText.trim() };
  }
);
```

- [ ] **Step 2: Commit**

```bash
git add src/ai/flows/translate-message.ts
git commit -m "feat(ai): add translate-message Genkit flow"
```

---

### Task 19: Create translate-ui-strings Genkit flow and generate es.json + ru.json

**Files:**
- Create: `src/ai/flows/translate-ui-strings.ts`
- Create: `src/messages/es.json`
- Create: `src/messages/ru.json`

- [ ] **Step 1: Create the flow**

`src/ai/flows/translate-ui-strings.ts`:
```typescript
'use server';

import { ai } from '@/lib/ai';
import {
  TranslateUiStringsInputSchema,
  TranslateUiStringsOutputSchema,
} from '@/ai/schemas/translate-ui-strings-schema';

const LOCALE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  ru: 'Russian',
};

export const translateUiStrings = ai.defineFlow(
  {
    name: 'translateUiStrings',
    inputSchema: TranslateUiStringsInputSchema,
    outputSchema: TranslateUiStringsOutputSchema,
  },
  async (input) => {
    const targetName = LOCALE_NAMES[input.targetLocale] || input.targetLocale;
    const entries = Object.entries(input.sourceStrings);
    const jsonStr = JSON.stringify(input.sourceStrings, null, 2);

    const { text } = await ai.generate({
      model: 'googleai/gemini-2.0-flash',
      prompt: `Translate the following JSON object of UI strings from English to ${targetName}.
Rules:
- Preserve all JSON keys exactly as-is
- Translate only the string values
- Keep placeholders like {provider}, {date}, {count} unchanged
- Keep technical terms (API, OAuth, Firestore, etc.) unchanged
- Return valid JSON only, no markdown fencing

${jsonStr}`,
    });

    try {
      const translatedStrings = JSON.parse(text.trim());
      return { translatedStrings };
    } catch {
      // If JSON parsing fails, return empty — caller should retry
      return { translatedStrings: {} };
    }
  }
);
```

- [ ] **Step 2: Generate Spanish and Russian translation files**

This step requires running the Genkit flow. Since the flow needs a running Genkit server and API keys, generate the translation files manually by:

1. Flattening `en.json` into a key-value map (dot notation)
2. Translating via the AI flow or directly in the plan execution
3. Writing the output as `es.json` and `ru.json` with the same nested structure as `en.json`

The subagent executing this task should read `en.json`, produce correct translations for all keys, and write `es.json` and `ru.json` with identical structure but translated values.

- [ ] **Step 3: Verify all three JSON files have identical key structures**

```bash
node -e "
const en = require('./src/messages/en.json');
const es = require('./src/messages/es.json');
const ru = require('./src/messages/ru.json');
const check = (a, b, prefix='') => {
  for (const k of Object.keys(a)) {
    if (!(k in b)) console.log('Missing:', prefix+k);
    else if (typeof a[k] === 'object') check(a[k], b[k], prefix+k+'.');
  }
};
console.log('--- Missing in es.json ---');
check(en, es);
console.log('--- Missing in ru.json ---');
check(en, ru);
console.log('Done');
"
```

Expected: No "Missing:" lines.

- [ ] **Step 4: Commit**

```bash
git add src/ai/flows/translate-ui-strings.ts src/messages/es.json src/messages/ru.json
git commit -m "feat(i18n): add UI string translation flow and generate es/ru locale files"
```

---

## Chunk 5: Message Board — Service, AI Flow, Components

### Task 20: Create messages Firestore service

**Files:**
- Create: `src/services/hub/messages.ts`

- [ ] **Step 1: Create the service**

```typescript
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
  limit as firestoreLimit,
  startAfter,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  Thread,
  ThreadMessage,
  CreateThreadInput,
  PostMessageInput,
} from '@/types/hub';

const threadsRef = collection(db, 'workspaceThreads');

// --- Thread CRUD ---

export async function createThread(input: CreateThreadInput): Promise<string> {
  const docRef = await addDoc(threadsRef, {
    ...input,
    participants: [
      { id: input.freelancerId, role: 'freelancer', locale: 'en' },
      { id: input.clientId, role: 'client', locale: 'en' },
    ],
    lastMessageAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    createdBy: input.freelancerId,
  });
  return docRef.id;
}

export async function getThread(threadId: string): Promise<Thread | null> {
  const snap = await getDoc(doc(threadsRef, threadId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Thread;
}

export async function listThreads(workspaceId: string): Promise<Thread[]> {
  const q = query(
    threadsRef,
    where('workspaceId', '==', workspaceId),
    orderBy('lastMessageAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Thread);
}

export async function listThreadsByClient(clientId: string): Promise<Thread[]> {
  const q = query(
    threadsRef,
    where('clientId', '==', clientId),
    orderBy('lastMessageAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Thread);
}

// --- Message CRUD ---

function messagesCol(threadId: string) {
  return collection(threadsRef, threadId, 'messages');
}

export async function postMessage(
  threadId: string,
  input: PostMessageInput
): Promise<string> {
  const col = messagesCol(threadId);
  const docRef = await addDoc(col, {
    authorId: input.authorId,
    authorRole: input.authorRole,
    originalText: input.text,
    originalLocale: input.locale,
    translations: {},
    createdAt: serverTimestamp(),
  });

  // Update thread lastMessageAt
  await updateDoc(doc(threadsRef, threadId), {
    lastMessageAt: serverTimestamp(),
  });

  return docRef.id;
}

export async function listMessages(
  threadId: string,
  options?: { pageSize?: number; afterTimestamp?: Timestamp }
): Promise<ThreadMessage[]> {
  const col = messagesCol(threadId);
  const constraints = [orderBy('createdAt', 'asc')];

  if (options?.afterTimestamp) {
    constraints.push(startAfter(options.afterTimestamp));
  }

  constraints.push(firestoreLimit(options?.pageSize || 50));

  const q = query(col, ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ThreadMessage);
}

export async function addTranslation(
  threadId: string,
  messageId: string,
  locale: string,
  translatedText: string
): Promise<void> {
  const msgRef = doc(messagesCol(threadId), messageId);
  await updateDoc(msgRef, {
    [`translations.${locale}`]: translatedText,
  });
}

export async function updateParticipantLocale(
  threadId: string,
  participantId: string,
  locale: string
): Promise<void> {
  const thread = await getThread(threadId);
  if (!thread) return;

  const updatedParticipants = thread.participants.map((p) =>
    p.id === participantId ? { ...p, locale } : p
  );

  await updateDoc(doc(threadsRef, threadId), {
    participants: updatedParticipants,
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/services/hub/messages.ts
git commit -m "feat(hub): add messages Firestore service with thread CRUD and pagination"
```

---

### Task 21: Create message React Query hooks

**Files:**
- Create: `src/hooks/hub/use-messages.ts`

- [ ] **Step 1: Create the hooks**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listThreads,
  listThreadsByClient,
  listMessages,
  createThread,
  postMessage,
  addTranslation,
} from '@/services/hub/messages';
import type { CreateThreadInput, PostMessageInput } from '@/types/hub';
import { Timestamp } from 'firebase/firestore';

export function useThreads(workspaceId: string) {
  return useQuery({
    queryKey: ['threads', workspaceId],
    queryFn: () => listThreads(workspaceId),
    enabled: !!workspaceId,
  });
}

export function useClientThreads(clientId: string) {
  return useQuery({
    queryKey: ['threads-client', clientId],
    queryFn: () => listThreadsByClient(clientId),
    enabled: !!clientId,
  });
}

export function useMessages(
  threadId: string,
  options?: { pageSize?: number; afterTimestamp?: Timestamp }
) {
  return useQuery({
    queryKey: ['messages', threadId, options],
    queryFn: () => listMessages(threadId, options),
    enabled: !!threadId,
  });
}

export function useMessageMutations(workspaceId: string) {
  const queryClient = useQueryClient();

  const createThreadMut = useMutation({
    mutationFn: (input: CreateThreadInput) => createThread(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['threads', workspaceId] }),
  });

  const postMessageMut = useMutation({
    mutationFn: ({
      threadId,
      input,
    }: {
      threadId: string;
      input: PostMessageInput;
    }) => postMessage(threadId, input), // returns messageId: string
    onSuccess: (_, { threadId }) => {
      queryClient.invalidateQueries({ queryKey: ['messages', threadId] });
      queryClient.invalidateQueries({ queryKey: ['threads', workspaceId] });
    },
  });

  const addTranslationMut = useMutation({
    mutationFn: ({
      threadId,
      messageId,
      locale,
      text,
    }: {
      threadId: string;
      messageId: string;
      locale: string;
      text: string;
    }) => addTranslation(threadId, messageId, locale, text),
    onSuccess: (_, { threadId }) =>
      queryClient.invalidateQueries({ queryKey: ['messages', threadId] }),
  });

  return {
    createThread: createThreadMut,
    postMessage: postMessageMut,
    addTranslation: addTranslationMut,
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/hub/use-messages.ts
git commit -m "feat(hub): add React Query hooks for messaging"
```

---

### Task 22: Create shared messaging UI components

**Files:**
- Create: `src/components/messaging/message-bubble.tsx`
- Create: `src/components/messaging/thread-list.tsx`
- Create: `src/components/messaging/thread-view.tsx`

- [ ] **Step 1: Create message-bubble component**

`src/components/messaging/message-bubble.tsx`:

A `'use client'` component that renders a single message bubble.

Props:
- `message: ThreadMessage` — the message data
- `currentUserId: string` — to determine if the message is from the current user (right-aligned) or other (left-aligned)
- `currentLocale: string` — to pick the right translation
- `onRetryTranslation?: (messageId: string) => void` — callback for retry button

Behavior:
- If `message.authorId === currentUserId`, render right-aligned with `bg-primary text-primary-foreground`
- Otherwise, render left-aligned with `bg-gray-100`
- Show the translation for `currentLocale` if it exists in `message.translations`, otherwise show `message.originalText`
- "Show original" / "Show translation" toggle button (small text link below the bubble)
- If no translation exists and message language differs from currentLocale, show a "Retry translation" button
- Author role badge (`Freelancer` / `Client`) and timestamp below the bubble

- [ ] **Step 2: Create thread-list component**

`src/components/messaging/thread-list.tsx`:

A `'use client'` component that renders the left panel thread list.

Props:
- `threads: Thread[]`
- `selectedThreadId: string | null`
- `onSelectThread: (threadId: string) => void`
- `onNewThread: () => void`

Behavior:
- "New Thread" button at top
- ScrollArea with thread items
- Each thread shows: subject, `lastMessageAt` relative timestamp
- Selected thread highlighted with `bg-primary/10`

- [ ] **Step 3: Create thread-view component**

`src/components/messaging/thread-view.tsx`:

A `'use client'` component that renders the right panel with messages + compose box.

Props:
- `threadId: string`
- `currentUserId: string`
- `currentUserRole: 'freelancer' | 'client'`
- `currentLocale: string`
- `onSendMessage: (text: string) => void`
- `onRetryTranslation?: (messageId: string) => void`
- `sending?: boolean`

Behavior:
- Uses `useMessages(threadId)` to fetch messages
- Renders `MessageBubble` for each message
- ScrollArea with auto-scroll to bottom via `bottomRef`
- Compose box at bottom: `Input` + `Send` button
- Empty state when no messages

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/components/messaging/
git commit -m "feat(messaging): add shared message-bubble, thread-list, and thread-view components"
```

---

### Task 23: Create workspace-messages tab component

**Files:**
- Create: `src/components/hub/workspace-messages.tsx`
- Modify: `src/components/hub/workspace-detail.tsx`

- [ ] **Step 1: Create workspace-messages component**

`src/components/hub/workspace-messages.tsx`:

A `'use client'` component for the freelancer's Messages tab within a workspace.

Props:
- `freelancerId: string`
- `workspaceId: string`

Behavior:
- Uses `useThreads(workspaceId)` for thread list
- Uses `useMessageMutations(workspaceId)` for creating threads and posting messages
- Uses `useWorkspace(freelancerId, workspaceId)` to get `clientId` for new thread creation
- Uses `useLocale()` from next-intl for the current locale
- Two-panel layout: `ThreadList` on left (w-72), `ThreadView` on right
- "New Thread" dialog asks for subject, then calls `createThread` with workspace's `freelancerId` + `clientId`
- If workspace has no `clientId`, show a message: "Connect a client to this workspace to start messaging."

**Translation wiring on send:**
```typescript
import { translateMessage } from '@/ai/flows/translate-message';

async function handleSendMessage(text: string) {
  if (!selectedThreadId || !thread) return;
  const locale = currentLocale; // from useLocale()

  // 1. Post the message
  const messageId = await postMessage.mutateAsync({
    threadId: selectedThreadId,
    input: { authorId: freelancerId, authorRole: 'freelancer', text, locale },
  });

  // 2. Determine target locale from the other participant
  const otherParticipant = thread.participants.find(
    (p) => p.id !== freelancerId
  );
  const targetLocale = otherParticipant?.locale;

  // 3. Translate if locales differ
  if (targetLocale && targetLocale !== locale) {
    try {
      const { translatedText } = await translateMessage({
        text,
        sourceLocale: locale,
        targetLocale,
      });
      await addTranslation.mutateAsync({
        threadId: selectedThreadId,
        messageId,
        locale: targetLocale,
        text: translatedText,
      });
    } catch {
      // Translation failed — message is posted without translation.
      // User can retry via the "Retry translation" button on the bubble.
    }
  }
}
```

- [ ] **Step 2: Wire into workspace-detail**

In `workspace-detail.tsx`, import `WorkspaceMessages` and add the Messages `TabsContent`:

```typescript
import { WorkspaceMessages } from '@/components/hub/workspace-messages';

// In the Tabs:
<TabsTrigger value="messages">{t('messages')}</TabsTrigger>

<TabsContent value="messages">
  <WorkspaceMessages freelancerId={freelancerId} workspaceId={workspaceId} />
</TabsContent>
```

- [ ] **Step 3: Verify dev server renders**

```bash
npm run dev
```

- [ ] **Step 4: Commit**

```bash
git add src/components/hub/workspace-messages.tsx src/components/hub/workspace-detail.tsx
git commit -m "feat(hub): add workspace Messages tab with AI translation"
```

---

### Task 24: Create client messages component

**Files:**
- Create: `src/components/client-messages.tsx`
- Modify: `src/components/client-dashboard.tsx`

- [ ] **Step 1: Create client-messages component**

`src/components/client-messages.tsx`:

A `'use client'` component for the client's message view.

Props:
- `clientId: string`

Behavior:
- Uses `useClientThreads(clientId)` for thread list across all workspaces
- Groups threads by `workspaceId` with workspace name headers
- Uses `useMessageMutations('')` for post/translate, but also manually invalidates client thread queries:
  ```typescript
  const queryClient = useQueryClient();
  // After posting a message:
  queryClient.invalidateQueries({ queryKey: ['threads-client', clientId] });
  ```
- Same `ThreadList` + `ThreadView` layout as freelancer side
- Uses `useLocale()` for current locale
- On send: calls `postMessage`, then `translateMessage` + `addTranslation`

- [ ] **Step 2: Add Messages section to client dashboard**

Read `src/components/client-dashboard.tsx`. Add a new "Messages" tab or section that renders `<ClientMessages clientId={clientId} />`.

The client dashboard already has a tabbed or sectioned layout — add Messages alongside the existing sections (Freelancer History, Current Projects, etc.).

- [ ] **Step 3: Verify dev server renders**

```bash
npm run dev
```

- [ ] **Step 4: Commit**

```bash
git add src/components/client-messages.tsx src/components/client-dashboard.tsx
git commit -m "feat(client): add Messages section to client dashboard with AI translation"
```

---

### Task 25: Update workspace creation to include clientId

**Files:**
- Modify: `src/services/hub/workspaces.ts`
- Modify: `src/components/hub/hub-dashboard.tsx`

- [ ] **Step 1: Update createWorkspace service**

Read `src/services/hub/workspaces.ts`. Ensure the `createWorkspace` function accepts and stores an optional `clientId` field:

In the function that creates the workspace document, add `clientId` to the data object if provided.

- [ ] **Step 2: Add client selector to New Workspace dialog**

Read `src/components/hub/hub-dashboard.tsx`. In the "New Workspace" dialog form, add an optional client selector. Use `getProjectsByClientId` or similar to populate the dropdown — or since this is a freelancer creating a workspace, just add a `clientId` text input field for now (the full client selector can be improved later with a project-based lookup).

Add a `clientId` state field to the dialog form, pass it to `create.mutateAsync({ name, clientName, engagementType, clientId })`.

- [ ] **Step 3: Verify workspace creation still works**

```bash
npm run dev
```

- [ ] **Step 4: Commit**

```bash
git add src/services/hub/workspaces.ts src/components/hub/hub-dashboard.tsx
git commit -m "feat(hub): add clientId to workspace creation for message board"
```

---

### Task 26: Final verification and cleanup

**Files:**
- No new files

- [ ] **Step 1: Run full TypeScript check**

```bash
npx tsc --noEmit
```

Fix any type errors.

- [ ] **Step 2: Run dev server and verify all pages**

```bash
npm run dev
```

Check:
- `/freelancer/hub` — dashboard loads, workspaces render
- `/freelancer/hub/{workspaceId}` — all tabs render (Overview, Apps, Notes, App Messages, Messages, Files, Timeline, AI Briefing, Access & Permissions)
- Locale switcher in header changes language
- Client dashboard at `/client/dashboard` — Messages section renders

- [ ] **Step 3: Run production build**

```bash
npm run build
```

Fix any build errors.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(hub): resolve build errors from refactor"
```
