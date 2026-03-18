# Client Systems Hub — State Management Refactor, i18n & Message Board

**Date:** 2026-03-18
**Status:** Approved
**Branch:** `feat/client-systems-hub` (continues existing work)

---

## 1. Overview

Three improvements to the Client Systems Hub:

1. **State management refactor** — Replace manual `useState`/`useEffect` data fetching in all hub components with React Query hooks + Zustand for UI state
2. **i18n** — Add English/Spanish/Russian UI localization via next-intl with AI-generated translations
3. **Message board** — Workspace-scoped threaded messaging between freelancers and clients with AI-powered translation on post

## 2. State Management Layer

### 2.1 React Query — Server State

All hub data fetching moves to custom hooks wrapping existing Firestore services. React Query handles caching, deduplication, and automatic refetch after mutations.

**New hooks (`src/hooks/hub/`):**

| Hook File | Exports |
|-----------|---------|
| `use-workspace.ts` | `useWorkspace(fid, wid)`, `useWorkspaces(fid)`, `useWorkspaceMutations()` |
| `use-connections.ts` | `useConnections(fid, wid)`, `useConnectionMutations()` |
| `use-activity.ts` | `useActivityEvents(fid, wid, filters?)` |
| `use-bookmarks.ts` | `useBookmarks(fid, wid)`, `useBookmarkMutations()` |
| `use-notes.ts` | `useNotes(fid, wid)`, `useNoteMutations()` |
| `use-briefings.ts` | `useBriefings(fid, wid)`, `useLatestBriefing(fid, wid)` |
| `use-messages.ts` | `useThreads(fid, wid)`, `useMessages(threadId)`, `useMessageMutations()` |

**Mutation pattern:**
```typescript
// Example: useBookmarkMutations
export function useBookmarkMutations(freelancerId: string, workspaceId: string) {
  const queryClient = useQueryClient();
  const key = ['bookmarks', freelancerId, workspaceId];

  const add = useMutation({
    mutationFn: (data: CreateBookmarkInput) => addBookmark(freelancerId, workspaceId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteBookmark(freelancerId, workspaceId, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return { add, remove };
}
```

**QueryClientProvider:** Added to `src/app/layout.tsx` (root layout) since both freelancer hub and client dashboard need React Query. A shared `src/components/providers.tsx` wraps `QueryClientProvider` + `NextIntlClientProvider` + `AuthProvider` in one component to keep the root layout clean.

### 2.2 Zustand — Client/UI State

One store for cross-component UI state that doesn't belong in React Query:

**File:** `src/stores/hub-store.ts`

```typescript
interface HubStore {
  sidebarOpen: boolean;
  activeFilters: { provider?: string; sourceType?: string };
  chatDrafts: Record<string, string>; // workspaceId → draft text
  toggleSidebar: () => void;
  setFilter: (key: string, value: string | undefined) => void;
  setChatDraft: (workspaceId: string, text: string) => void;
}
```

No workspace/freelancer IDs in Zustand — those come from URL params and auth context. Locale is NOT stored in Zustand — it lives exclusively in the next-intl cookie, accessed via `useLocale()` from next-intl. The locale switcher in the header writes the cookie directly and triggers a page reload.

### 2.3 What Gets Removed from Components

- All `useState` + `useEffect` fetch patterns → `useQuery`
- All manual refetch callbacks (`fetchData`, `refreshNotes`, etc.) → mutation invalidation
- Duplicate fetches (sidebar + dashboard both fetching workspaces) → React Query deduplication
- `WorkspaceDetail` passing connections as props to children → each child uses `useConnections()` from cache
- `NoteEditor`'s `useRef(initialized)` hack → proper React Query initialization

## 3. Internationalization (i18n)

### 3.1 Setup

**Package:** `next-intl` (App Router compatible)

**Routing strategy:** Cookie-based, not path-based. No `/es/freelancer/hub` URLs. Locale stored in a `NEXT_LOCALE` cookie read by next-intl middleware.

**Files:**
```
src/i18n/
  request.ts         → getRequestConfig() reads locale from cookie
  routing.ts         → locales: ['en', 'es', 'ru'], defaultLocale: 'en'
src/middleware.ts     → next-intl middleware, cookie-based locale negotiation (no path rewriting)
src/messages/
  en.json            → English source strings (hand-authored)
  es.json            → Spanish (AI-generated)
  ru.json            → Russian (AI-generated)
```

### 3.1.1 Middleware & Provider Setup

**`src/middleware.ts`** — next-intl middleware configured for cookie-based locale:
```typescript
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing, {
  localeDetection: false, // use cookie only, no Accept-Language
});

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
```

**`src/components/providers.tsx`** — Shared provider wrapper used in root layout:
```tsx
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { AuthProvider } from '@/contexts/auth-context';

const queryClient = new QueryClient();

export function Providers({ children, locale, messages }) {
  return (
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}
```

**`src/app/layout.tsx`** — Root layout wraps children in `<Providers>`, passing locale and messages from `getRequestConfig()`.

### 3.2 Translation Generation

A Genkit flow `translate-ui-strings` batch-translates `en.json` into target locales:

```
Input:  { sourceStrings: Record<string, string>, targetLocale: string }
Output: { translatedStrings: Record<string, string> }
```

Run manually when UI strings change. Output committed to repo as static JSON.

### 3.3 Scope

Only hub pages and shared layout components (header, footer) get i18n'd in this pass. Auth pages and landing page follow later.

Estimated ~100-150 string keys across all hub UI.

### 3.4 Component Usage

```tsx
const t = useTranslations('hub');
<h1>{t('dashboard.title')}</h1>
```

## 4. Message Board

### 4.1 Prerequisites — Workspace Schema Change

The `Workspace` type currently has `clientName: string` (display-only) but no foreign key to the `clients` collection. The message board needs a real `clientId` to scope thread access.

**Schema change in `src/types/hub.ts`:**
```typescript
export interface Workspace {
  // ... existing fields ...
  clientId: string; // NEW — references clients/{cid}
  clientName: string; // existing — kept for display
}
```

**Migration:** Add `clientId` as an optional field initially. The "New Workspace" dialog in `hub-dashboard.tsx` gets a client selector (dropdown populated from the freelancer's assigned projects via `getAssignedProjects()`). Existing workspaces without `clientId` cannot use the message board until updated.

**Also replace hardcoded `FREELANCER_ID`** in hub pages (`layout.tsx`, `page.tsx`, `[workspaceId]/page.tsx`) with `useAuth()` from `AuthProvider`. This is required for message board `authorId` to work.

### 4.2 Data Model

**Top-level Firestore collection** (not nested under freelancers, so both sides can query):

```
workspaceThreads/{tid}
  subject: string
  workspaceId: string
  freelancerId: string
  clientId: string
  participants: Array<{ id: string, role: 'freelancer' | 'client', locale: string }>
  lastMessageAt: Timestamp
  createdAt: Timestamp
  createdBy: string

workspaceThreads/{tid}/messages/{mid}
  authorId: string
  authorRole: 'freelancer' | 'client'
  originalText: string
  originalLocale: string
  translations: { en?: string, es?: string, ru?: string }
  createdAt: Timestamp
```

**TypeScript types added to `src/types/hub.ts`:**
```typescript
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

export interface ThreadParticipant {
  id: string;
  role: 'freelancer' | 'client';
  locale: string;
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

### 4.3 Translation Flow

**Genkit flow: `translate-message`**

```
Input:  { text: string, sourceLocale: string, targetLocale: string }
Output: { translatedText: string }
```

Called on post (not on read). Translation stored once in the message's `translations` map.

**Logic:**
1. Freelancer posts in English → detect locale → translate to client's locale (from participant record) → store in `translations.{clientLocale}`
2. Client replies in Russian → translate to freelancer's locale → store in `translations.{freelancerLocale}`
3. Readers see translation for their locale. If no translation exists (e.g., same language), they see `originalText`.
4. "Show original" toggle on each message bubble.
5. Lazy translation: if a user changes locale and no translation exists, trigger on-demand and cache.

### 4.4 Firestore Service

**File:** `src/services/hub/messages.ts`

```typescript
// Thread CRUD
createThread(workspaceId, freelancerId, clientId, subject): Promise<string>
getThread(threadId): Promise<Thread>
listThreads(workspaceId): Promise<Thread[]>
listThreadsByClient(clientId): Promise<Thread[]>

// Message CRUD
postMessage(threadId, authorId, authorRole, text, locale): Promise<string>
listMessages(threadId, options?): Promise<Message[]>
addTranslation(threadId, messageId, locale, text): Promise<void>
```

### 4.5 Message Pagination

`listMessages(threadId, options?)` uses cursor-based pagination with Firestore `startAfter`. Default page size: 50 messages. The `ThreadView` component implements infinite scroll upward (load older messages on scroll to top).

### 4.6 Translation Failure Handling

If the `translate-message` Genkit flow fails (timeout, rate limit), the message is posted with `translations: {}`. All readers see `originalText`. A "Retry translation" button appears on untranslated messages, triggering `addTranslation()` on demand.

### 4.7 Tab Naming

The existing "Messages" tab in `workspace-detail.tsx` (which shows Slack/app messages from `ActivityTimeline` filtered to `sourceType="message"`) is renamed to **"App Messages"**. The new message board tab is called **"Messages"**.

### 4.8 Freelancer Viewport — Messages Tab

Added as a tab in `workspace-detail.tsx`:

**Component:** `src/components/hub/workspace-messages.tsx`

- Uses shared `ThreadList` + `ThreadView` components
- Queries threads by `workspaceId`
- "New Thread" creates a thread linking the workspace's `freelancerId` + `clientId` (derived from the workspace's associated project)

### 4.9 Client Viewport — Messages Section

**Component:** `src/components/client-messages.tsx`

- Added to the client dashboard
- Queries threads by `clientId` using `listThreadsByClient()`
- Groups threads by workspace/project
- Same `ThreadList` + `ThreadView` components, styled to match client dashboard

### 4.10 Shared Messaging Components

```
src/components/messaging/
  thread-list.tsx       → Left panel: thread list with subject, last message preview, timestamp
  thread-view.tsx       → Right panel: messages + compose box
  message-bubble.tsx    → Single message with translated text, "show original" toggle, author badge
```

## 5. Component Refactor Matrix

### 5.1 Existing Components Modified

| Component | Changes |
|-----------|---------|
| `hub-sidebar.tsx` | Replace fetch with `useWorkspaces()`, add i18n |
| `hub-dashboard.tsx` | Replace fetch with `useWorkspaces()` + `useWorkspaceMutations()`, add i18n |
| `workspace-detail.tsx` | Replace fetch with `useWorkspace()` + `useConnections()`, add Messages tab, add i18n |
| `workspace-card.tsx` | Replace fetch with `useActivityEvents()`, add i18n |
| `activity-timeline.tsx` | Replace fetch with `useActivityEvents()`, add `useConnections()` internally for write action buttons (replaces `connections` prop), use Zustand for filters, add i18n |
| `bookmark-list.tsx` | Replace fetch with `useBookmarks()` + `useBookmarkMutations()`, add i18n |
| `note-editor.tsx` | Replace fetch with `useNotes()` + `useNoteMutations()`, remove ref hack, add i18n |
| `access-permissions.tsx` | Replace fetch with `useConnections()` + `useActivityEvents()`, add i18n |
| `ai-briefing-panel.tsx` | Replace fetch with `useLatestBriefing()` + `useBriefings()`, add i18n |
| `workspace-chat.tsx` | Add i18n |
| `connection-setup-dialog.tsx` | Add i18n |
| `connection-tile.tsx` | Add i18n |
| `header-navigation-client.tsx` | Add locale switcher dropdown |
| `client-dashboard.tsx` | Add Messages section with `ClientMessages` component |

### 5.2 New Files

| File | Purpose |
|------|---------|
| `src/components/providers.tsx` | Shared provider wrapper (QueryClient + NextIntl + Auth) |
| `src/middleware.ts` | next-intl middleware for cookie-based locale |
| `src/hooks/hub/use-workspace.ts` | React Query hooks for workspaces |
| `src/hooks/hub/use-connections.ts` | React Query hooks for connections |
| `src/hooks/hub/use-activity.ts` | React Query hooks for activity events |
| `src/hooks/hub/use-bookmarks.ts` | React Query hooks for bookmarks |
| `src/hooks/hub/use-notes.ts` | React Query hooks for notes |
| `src/hooks/hub/use-briefings.ts` | React Query hooks for AI briefings |
| `src/hooks/hub/use-messages.ts` | React Query hooks for threads + messages |
| `src/stores/hub-store.ts` | Zustand UI state store |
| `src/i18n/request.ts` | next-intl request config |
| `src/i18n/routing.ts` | Locale routing config |
| `src/messages/en.json` | English UI strings |
| `src/messages/es.json` | Spanish UI strings (AI-generated) |
| `src/messages/ru.json` | Russian UI strings (AI-generated) |
| `src/ai/flows/translate-message.ts` | Genkit message translation flow |
| `src/ai/flows/translate-ui-strings.ts` | Genkit batch UI string translation flow |
| `src/ai/schemas/translate-message-schema.ts` | Zod schema for message translation |
| `src/ai/schemas/translate-ui-strings-schema.ts` | Zod schema for UI string translation |
| `src/services/hub/messages.ts` | Firestore service for threads + messages |
| `src/components/messaging/thread-list.tsx` | Shared thread list component |
| `src/components/messaging/thread-view.tsx` | Shared thread + compose view |
| `src/components/messaging/message-bubble.tsx` | Single message with translation toggle |
| `src/components/hub/workspace-messages.tsx` | Freelancer Messages tab wrapper |
| `src/components/client-messages.tsx` | Client dashboard Messages section |

### 5.3 Unchanged

All `src/services/hub/*.ts` Firestore services (except new `messages.ts`), all `src/services/integrations/*.ts` provider services, all existing `src/ai/flows/workspace-*.ts` AI flows, all API routes.

## 6. New Dependencies

| Package | Purpose | Size |
|---------|---------|------|
| `zustand` | Client UI state management | ~1.1kb gzipped |
| `next-intl` | App Router i18n | ~5kb gzipped |

`@tanstack/react-query` is already installed — this refactor activates it. `@tanstack-query-firebase/react` is also installed but not used by the new hooks (we use plain `useQuery`/`useMutation` wrapping our existing Firestore service functions). It can be removed to reduce bundle size.

## 7. Security

- `workspaceThreads` Firestore security rules: only `freelancerId` or `clientId` on the thread document can read/write
- Messages inherit thread-level access
- Translation flow is server-side only (Genkit `'use server'`)
- No PII in translation requests beyond the message text itself
