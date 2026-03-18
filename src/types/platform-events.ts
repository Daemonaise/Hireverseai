import { Timestamp } from 'firebase/firestore';

// --- Vertex AI Search Datastores ---
export type DatastoreId =
  | 'skill-taxonomy'
  | 'project-knowledge'
  | 'freelancer-profiles'
  | 'platform-policies'
  | 'qa-feedback';

export const DATASTORE_ENV_MAP: Record<DatastoreId, string> = {
  'skill-taxonomy': 'VERTEX_SEARCH_DATASTORE_SKILLS',
  'project-knowledge': 'VERTEX_SEARCH_DATASTORE_PROJECTS',
  'freelancer-profiles': 'VERTEX_SEARCH_DATASTORE_FREELANCERS',
  'platform-policies': 'VERTEX_SEARCH_DATASTORE_POLICIES',
  'qa-feedback': 'VERTEX_SEARCH_DATASTORE_QA',
};

// --- Platform Events ---
export type PlatformEventType =
  | 'assessment_complete'
  | 'project_complete'
  | 'qa_review'
  | 'milestone_complete'
  | 'match_result';

export type PlatformEventStatus = 'raw' | 'cleaned' | 'indexed' | 'rejected';

export interface PlatformEvent {
  id: string;
  type: PlatformEventType;
  rawData: Record<string, unknown>;
  status: PlatformEventStatus;
  targetDatastore: DatastoreId;
  cleanedData?: Record<string, unknown>;
  rejectionReason?: string;
  qualityScore?: number;
  createdAt: Timestamp;
  processedAt?: Timestamp;
}

// --- Search Types ---
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

// --- Cleaning Pipeline Types ---
export interface CleaningResult {
  accepted: boolean;
  qualityScore: number;
  cleanedContent?: string;
  cleanedMetadata?: Record<string, string>;
  rejectionReason?: string;
}
