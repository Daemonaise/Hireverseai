# Client Systems Hub — Design Spec

**Date:** 2026-03-16
**Status:** Approved
**Source doc:** `docs/hireverse_client_systems_hub.md`

---

## Overview

The Client Systems Hub is a workspace layer that replaces the existing freelancer dashboard. It allows freelancers to connect, organize, and operate across each client's software ecosystem from one interface. Each client engagement becomes a secure workspace containing real OAuth integrations, tasks, communications, files, and AI-powered activity summaries.

### Key Decisions

- **Approach:** Modular service architecture (Approach B) — each phase maps to independent modules with clear boundaries
- **Replaces:** Existing freelancer dashboard (`/freelancer/dashboard` redirects to `/freelancer/hub`)
- **Integrations:** Real OAuth flows (not stubs) for the 5 highest-usage tools: Slack, GitHub, Google Drive, Trello, Notion
- **AI assistant:** Both background summarization and conversational chat, scoped per workspace
- **All 4 phases** are in scope, built incrementally

---

## 1. Route Structure & Layout

### Routes

| Route | Purpose |
|-------|---------|
| `/freelancer/hub` | Hub dashboard — all workspaces overview |
| `/freelancer/hub/[workspaceId]` | Workspace detail — tabbed view |
| `/api/integrations/[provider]/callback` | OAuth callback handler per provider |
| `/api/hub/chat` | Workspace AI chat endpoint |

### Layout

`src/app/freelancer/hub/layout.tsx` wraps all hub pages:

- **Left sidebar** — workspace list (active/archived), "New Workspace" button, app connections link
- **Main content** — rendered by child route

The existing `/freelancer/dashboard` redirects to `/freelancer/hub`. Header navigation updated to point to the hub.

---

## 2. Data Model

Workspaces and their data live as subcollections under the freelancer document in Firestore:

```
freelancers/{freelancerId}/
  workspaces/{workspaceId}/
    ├── name: string
    ├── clientName: string
    ├── engagementType: string
    ├── status: 'active' | 'archived'
    ├── createdAt: Timestamp
    ├── updatedAt: Timestamp
    │
    connections/{connectionId}/
    │   ├── provider: 'slack' | 'github' | 'google-drive' | 'trello' | 'notion'
    │   ├── label: string
    │   ├── launchUrl: string
    │   ├── scopes: string[]
    │   ├── accessToken: string          (encrypted at rest)
    │   ├── refreshToken: string         (encrypted at rest)
    │   ├── tokenExpiresAt: Timestamp
    │   ├── status: 'connected' | 'disconnected' | 'error'
    │   ├── lastSyncAt: Timestamp
    │   └── createdAt: Timestamp
    │
    bookmarks/{bookmarkId}/
    │   ├── title: string
    │   ├── url: string
    │   ├── description: string
    │   └── createdAt: Timestamp
    │
    notes/{noteId}/
    │   ├── title: string
    │   ├── content: string              (markdown)
    │   ├── createdAt: Timestamp
    │   └── updatedAt: Timestamp
    │
    activityEvents/{eventId}/            (Phase 2)
    │   ├── sourceProvider: string
    │   ├── sourceType: 'task' | 'message' | 'document' | 'ticket' | 'repository_event'
    │   ├── sourceExternalId: string
    │   ├── title: string
    │   ├── bodyExcerpt: string
    │   ├── status: string
    │   ├── assignee: string
    │   ├── dueDate: Timestamp
    │   ├── url: string
    │   ├── rawPayloadRef: string
    │   ├── createdAt: Timestamp
    │   └── updatedAt: Timestamp
    │
    aiBriefings/{briefingId}/            (Phase 3)
    │   ├── generatedAt: Timestamp
    │   ├── periodStart: Timestamp
    │   ├── periodEnd: Timestamp
    │   ├── summary: string
    │   ├── actionItems: string[]
    │   ├── blockers: string[]
    │   └── model: string
    │
    aiContext                             (Phase 3 — single document)
        └── markdown: string             (auto-generated context doc for AI)
```

### Key decisions

- OAuth tokens stored on connection documents; Firestore security rules restrict access to the owning freelancer only
- Activity events use the normalized `WorkspaceItem` schema from the source doc
- AI briefings are persisted for historical viewing, not regenerated each time
- AI context document is a single doc regenerated whenever connections, projects, or notes change

---

## 3. Integration Services

### File structure

```
src/services/integrations/
  ├── types.ts              → Shared interfaces (OAuthTokens, NormalizedActivity, ProviderConfig)
  ├── oauth.ts              → Generic OAuth helpers (buildAuthUrl, exchangeCode, refreshIfExpired)
  ├── slack.ts              → Slack: OAuth config, channels, messages, presence
  ├── github.ts             → GitHub: OAuth config, repos, issues, PRs, commits
  ├── google-drive.ts       → Google: OAuth config, files, activity, sharing
  ├── trello.ts             → Trello: OAuth config, boards, cards, lists
  └── notion.ts             → Notion: OAuth config, pages, databases, search
```

### Provider service convention

Each provider service exports the same shape (not a formal interface — a consistent convention):

```typescript
// Config
export const config: ProviderConfig;

// Phase 1 — Auth
export function getAuthUrl(redirectUri: string, state: string): string;
export function exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens>;
export function refreshToken(tokens: OAuthTokens): Promise<OAuthTokens>;

// Phase 1 — Launch
export function getLaunchUrl(connection: WorkspaceConnection): string;

// Phase 2 — Activity
export function fetchActivity(tokens: OAuthTokens, since: Date): Promise<NormalizedActivity[]>;

// Phase 4 — Write actions
export function createItem(tokens: OAuthTokens, payload: CreateItemPayload): Promise<void>;
```

Adding a 6th integration means adding one file that follows this convention.

### OAuth callback

A single dynamic API route `/api/integrations/[provider]/callback` handles all providers. It reads the `provider` param, looks up the correct service, exchanges the authorization code for tokens, and stores the connection in Firestore.

---

## 4. Hub UI Components

### File structure

```
src/components/hub/
  ├── hub-sidebar.tsx              → Workspace list, new workspace button, archive section
  ├── hub-dashboard.tsx            → Overview grid: workspace cards, connection health, recent activity
  ├── workspace-detail.tsx         → Tabbed workspace view
  ├── workspace-card.tsx           → Dashboard card: client name, status, app icons, last activity
  ├── connection-tile.tsx          → Connected app: icon, label, status dot, launch button
  ├── connection-setup-dialog.tsx  → OAuth flow trigger + scope consent
  ├── bookmark-list.tsx            → CRUD for workspace bookmarks
  ├── note-editor.tsx              → Markdown notes with create/edit/delete
  ├── activity-timeline.tsx        → (Phase 2) Normalized event feed, filterable by provider/type
  ├── ai-briefing-panel.tsx        → (Phase 3) Summary + action items + blockers
  └── workspace-chat.tsx           → (Phase 3) Conversational AI scoped to workspace
```

### Workspace detail tabs by phase

| Phase | Tabs |
|-------|------|
| Phase 1 | Overview (includes bookmarks), Apps, Notes |
| Phase 2 | Tasks, Messages, Files, Timeline |
| Phase 3 | AI Briefing (summarizer + chat) |
| Phase 4 | Write action buttons within Tasks/Messages tabs |

### Dashboard migration

The existing `freelancer-dashboard.tsx` project management UI (status selector, work submission, QA check) moves into the workspace Overview tab. Each workspace shows its assigned Hireverse projects alongside external tool connections.

---

## 5. AI Flows

### AI Context Documents

Each workspace gets an auto-generated markdown context document stored in Firestore (`workspaces/{wid}/aiContext`). It contains:

- Workspace metadata (client name, engagement type, status)
- Connected systems and their status
- Active Hireverse projects (name, status, skills, due date)
- Notes summary
- Workspace isolation rules

This document is **regenerated** whenever connections, projects, or notes change. Both the briefing flow and chat agent receive it as system context before any prompt.

### `workspace-briefing` flow

**File:** `src/ai/flows/workspace-briefing.ts`
**Schema:** `src/ai/schemas/workspace-briefing-schema.ts`

- **Input:** `workspaceId`, `freelancerId`, `periodStart`, `periodEnd`
- **Process:** Gathers activity events and notes for the period, loads AI context doc, prompts AI to produce structured output
- **Output:** `summary: string`, `actionItems: string[]`, `blockers: string[]`
- **Storage:** Result persisted in `aiBriefings` subcollection
- **Trigger:** Manual ("Generate briefing" button) or on schedule

### `workspace-chat-agent` flow

**File:** `src/ai/flows/workspace-chat-agent.ts`
**Schema:** `src/ai/schemas/workspace-chat-schema.ts`

Follows the existing `chatWithClientAgent` pattern, scoped to a single workspace.

**Tools available to the agent:**

| Tool | Purpose |
|------|---------|
| `listActivityEvents` | Query events by type/provider/date range |
| `getWorkspaceConnections` | List connected apps and status |
| `getRecentBriefing` | Fetch latest AI briefing |
| `listNotes` | Read workspace notes |
| `listBookmarks` | Read workspace bookmarks |
| `runQACheck` | Review a work submission (delegates to QA flow) |

**System prompt** establishes the agent as "Hireverse Workspace Assistant" with strict instruction to never leak data across workspaces. AI context doc is injected as system context.

**API route:** `POST /api/hub/chat` with `workspaceId`, `freelancerId`, `messages[]`

### `workspace-qa-review` flow

**File:** `src/ai/flows/workspace-qa-review.ts`
**Schema:** `src/ai/schemas/workspace-qa-review-schema.ts`

Replaces the current random pass/fail placeholder in the freelancer dashboard.

- **Input:** `workspaceId`, `projectId`, `submittedWork` (URL or text), `projectBrief`, `microtasks[]`
- **Context:** Original project brief, required skills, microtask descriptions, activity from connected systems (e.g., recent GitHub commits, related Trello cards)
- **Output:** `passed: boolean`, `score: number`, `feedback: string`, `issues: { severity: string, description: string, suggestion: string }[]`
- **Behavior:** If not passed, freelancer sees actionable feedback before resubmitting. If passed, proceeds to `review` status for client approval.
- Also accessible via the chat agent's `runQACheck` tool.

---

## 6. Development Phases

### Phase 1 — Workspace Launcher

- Hub layout with sidebar navigation
- Workspace CRUD (create, view, archive)
- Connection management: real OAuth flows for Slack, GitHub, Google Drive, Trello, Notion
- Deep-link launchpad tiles with connection health status
- Bookmarks and notes per workspace
- Redirect `/freelancer/dashboard` to `/freelancer/hub`
- Migrate existing project management UI into workspace Overview tab

### Phase 2 — Activity Aggregation

- `fetchActivity()` implementation for each provider
- Normalized activity event storage in Firestore
- Unified timeline component with filtering by provider/type
- Tasks, Messages, Files tabs populated from real integration data
- Unread counts and deadline indicators on workspace cards

### Phase 3 — AI Operations Layer

- AI context document generation and auto-refresh
- `workspace-briefing` flow: activity summarization, action item extraction, blocker detection
- `workspace-chat-agent` flow: conversational agent with workspace-scoped tools
- `workspace-qa-review` flow: replaces placeholder QA with real AI review
- AI Briefing tab in workspace detail

### Phase 4 — Write Actions

- `createItem()` implementation for each provider (create issues, post messages, upload files, change task states)
- Write action buttons in Tasks and Messages tabs
- Permission validation before write operations
- Confirmation dialogs for destructive actions

---

## 7. Security

- **Workspace isolation:** Firestore security rules restrict workspace data to the owning freelancer. AI context never crosses workspace boundaries.
- **OAuth tokens:** Stored encrypted on connection documents. Least-privilege scopes requested per provider.
- **Token refresh:** `refreshIfExpired()` called before every API request. Expired/revoked tokens set connection status to `error`.
- **Client revocation:** Freelancers can disconnect any integration, which revokes the token and deletes connection data.
- **Audit:** Connection changes (connect, disconnect, error) logged as activity events.

---

## 8. New Environment Variables

```bash
# Slack OAuth
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=

# GitHub OAuth
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Google OAuth (Drive)
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=

# Trello OAuth
TRELLO_API_KEY=
TRELLO_API_SECRET=

# Notion OAuth
NOTION_CLIENT_ID=
NOTION_CLIENT_SECRET=
```

---

## 9. Type Definitions

New file: `src/types/hub.ts`

Core types:

- `Workspace` — id, name, clientName, engagementType, status, timestamps
- `WorkspaceConnection` — id, provider, label, launchUrl, scopes, tokens, status, timestamps
- `Bookmark` — id, title, url, description, timestamp
- `Note` — id, title, content (markdown), timestamps
- `NormalizedActivity` — id, sourceProvider, sourceType, sourceExternalId, title, bodyExcerpt, status, assignee, dueDate, url, timestamps
- `AIBriefing` — id, generatedAt, periodStart, periodEnd, summary, actionItems, blockers, model
- `OAuthTokens` — accessToken, refreshToken, tokenExpiresAt, scopes
- `ProviderConfig` — id, name, icon, category, clientIdEnvVar, clientSecretEnvVar, authUrl, tokenUrl, scopes
- `QAReviewResult` — passed, score, feedback, issues[]
