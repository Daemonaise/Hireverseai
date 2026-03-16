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
  lastVisitedAt?: Timestamp | null;
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

export type ActivitySourceType = 'task' | 'message' | 'document' | 'ticket' | 'repository_event' | 'connection_event';

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
