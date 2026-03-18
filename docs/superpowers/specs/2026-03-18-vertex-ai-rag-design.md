# Vertex AI Migration + RAG Database Design Spec

**Date:** 2026-03-18
**Status:** Approved
**Depends on:** None (foundation for future RAG, data pipeline, model tuning specs)

---

## 1. Overview

Migrate from Google AI Studio (`@genkit-ai/google-genai`, API key auth) to Vertex AI (`@genkit-ai/vertexai`, GCP project auth). Add Vertex AI Search as a managed RAG solution. Build a data cleaning pipeline that curates platform data before indexing.

**Goals:**
- All 22 Genkit flows switch to Vertex AI endpoints
- 5 Vertex AI Search datastores provide RAG context to key flows
- Platform events are collected, cleaned by AI, and indexed automatically
- Zero downtime — migration is a provider swap, not a rewrite

---

## 2. Provider Migration

### What changes

| Before | After |
|---|---|
| `@genkit-ai/google-genai` (API key) | `@genkit-ai/vertexai` (GCP project auth) |
| `googleAI()` plugin | `vertexAI({ projectId, location })` plugin |
| `googleai/gemini-2.0-flash` model strings | `vertexai/gemini-2.0-flash` model strings |
| `GOOGLE_API_KEY` env var | `GOOGLE_CLOUD_PROJECT` + `GOOGLE_CLOUD_LOCATION` env vars |

### What stays the same
- OpenAI and Anthropic plugins — untouched
- All Genkit patterns (`ai.defineFlow`, `ai.defineTool`, `ai.generate`) — identical API
- All Zod schemas — unchanged
- `withRetry` utility — unchanged

### Auth
Vertex AI uses Application Default Credentials (ADC):
- **Production** (Cloud Run/GCE): automatic via service account
- **Development**: `gcloud auth application-default login` once, no API key needed

### Updated `src/lib/ai.ts`
```typescript
import { vertexAI } from '@genkit-ai/vertexai';

const plugins: GenkitPlugin[] = [];

const gcpProject = process.env.GOOGLE_CLOUD_PROJECT;
const gcpLocation = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
if (gcpProject) {
  plugins.push(vertexAI({ projectId: gcpProject, location: gcpLocation }));
}

if (OPENAI_API_KEY) plugins.push(openAI());
if (ANTHROPIC_API_KEY) plugins.push(anthropic());

export const ai = genkit({ plugins });
```

### Model string migration
All 22 flows: find-and-replace `googleai/` → `vertexai/` in model string references.

---

## 3. Vertex AI Search (RAG)

### Datastores

| Datastore ID | Contents | Updated when |
|---|---|---|
| `skill-taxonomy` | Service categories, skills, sub-skills, certification criteria, assessment question patterns | On deploy / admin update |
| `project-knowledge` | Completed project briefs, decomposition plans, milestone structures, QA outcomes | After project completion |
| `freelancer-profiles` | Anonymized skill scores, cognitive profiles, certification levels, historical performance summaries | After assessment or project completion |
| `platform-policies` | Pricing rules, pay rate formulas, matching criteria, QA thresholds, retest policies | On deploy / admin update |
| `qa-feedback` | QA review results, common issues by category, quality benchmarks per skill level | After QA reviews |

### Search utility

`src/lib/vertex-search.ts`:
```typescript
async function searchDatastore(
  datastoreId: string,
  query: string,
  options?: { maxResults?: number; filter?: string }
): Promise<SearchResult[]>
```

### Flows that use RAG context

| Flow | Datastore | How it helps |
|---|---|---|
| `generate-project-plan.ts` | `project-knowledge` | Similar past projects inform decomposition |
| `freelancer-matcher.ts` | `freelancer-profiles` | Find candidates matching skill requirements |
| `generate-skill-question.ts` | `skill-taxonomy` | Category-specific question patterns |
| `qa-milestone-review.ts` | `qa-feedback` | Common issues in the relevant skill category |
| `workspace-briefing.ts` | `project-knowledge` | Related project context for briefing generation |

Flows that do NOT need RAG: translation flows, chat agents (already have workspace context), utility flows.

### Document ingestion

`src/services/vertex-ingest.ts`:
```typescript
async function indexDocument(
  datastoreId: string,
  doc: { id: string; content: string; metadata: Record<string, string> }
): Promise<void>

async function deleteDocument(datastoreId: string, docId: string): Promise<void>
```

---

## 4. Data Cleaning Pipeline

### Three-stage pipeline

**Stage 1: Collection**

Every significant platform event writes to Firestore `platformEvents/{eventId}`:
```typescript
interface PlatformEvent {
  id: string;
  type: 'assessment_complete' | 'project_complete' | 'qa_review' | 'milestone_complete' | 'match_result';
  rawData: Record<string, unknown>;
  status: 'raw' | 'cleaned' | 'indexed' | 'rejected';
  cleanedData?: Record<string, unknown>;
  rejectionReason?: string;
  qualityScore?: number;
  targetDatastore?: string;
  createdAt: Timestamp;
  processedAt?: Timestamp;
}
```

**Stage 2: Cleaning (AI-powered)**

Genkit flow `clean-platform-data.ts` processes raw events:

1. **Deduplication** — Skip if near-identical document exists in datastore
2. **Quality filter** — AI scores 0-100. Below 40 → rejected. 40-70 → cleaned with corrections. 70+ → accepted as-is
3. **PII scrubbing** — Strip names, emails, phone numbers. Freelancer data uses anon IDs only
4. **Normalization** — Standardize skill names to taxonomy, normalize formatting, extract structured metadata
5. **Summarization** — For verbose data, generate concise summary preserving key facts

**Stage 3: Indexing**

Clean documents routed to appropriate datastore and indexed via `vertex-ingest.ts`.

### Timing strategy (hybrid)

| Event type | Processing | Reason |
|---|---|---|
| `assessment_complete` | Immediate | Directly impacts matching quality |
| `project_complete` | Immediate | High-value training data |
| `qa_review` | Batch (hourly) | Volume is higher, can tolerate staleness |
| `milestone_complete` | Batch (hourly) | Mid-priority |
| `match_result` | Batch (hourly) | Used for feedback loop optimization |

### Data lifecycle

- Raw events: kept 90 days in Firestore (debugging/reprocessing)
- Cleaned documents: persisted in Vertex AI Search indefinitely
- Rejected events: kept 30 days with rejection reason (auditing)
- Monthly quality audit: sample 50 indexed docs, AI re-scores, flag degradation

---

## 5. File Map

### New files
```
src/lib/vertex-search.ts                — Search client (query datastores)
src/services/vertex-ingest.ts            — Document indexing (upload/delete)
src/services/platform-events.ts          — Raw event collection (Firestore)
src/ai/flows/clean-platform-data.ts      — AI cleaning flow
src/ai/schemas/clean-platform-data-schema.ts
src/types/platform-events.ts             — Event types, datastore IDs, document schemas
```

### Modified files
```
src/lib/ai.ts                            — Swap googleAI → vertexAI plugin
src/lib/ai-models.ts                     — Update model references
package.json                              — Swap @genkit-ai/google-genai → @genkit-ai/vertexai
.env                                      — New env vars

src/ai/flows/*.ts                        — All 22 flows: model string prefix swap
                                         — 4-5 key flows: add searchDatastore() for RAG

src/services/hub/briefings.ts            — Emit platform event after store
src/services/hub/activity.ts             — Emit platform event (batch)
src/services/milestones.ts               — Emit platform event after QA gate
```

---

## 6. Environment Variables

```
# Vertex AI (replaces GOOGLE_API_KEY)
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_LOCATION=us-central1

# Vertex AI Search datastores
VERTEX_SEARCH_DATASTORE_SKILLS=projects/{project}/locations/global/collections/default_collection/dataStores/skill-taxonomy
VERTEX_SEARCH_DATASTORE_PROJECTS=projects/{project}/locations/global/collections/default_collection/dataStores/project-knowledge
VERTEX_SEARCH_DATASTORE_FREELANCERS=projects/{project}/locations/global/collections/default_collection/dataStores/freelancer-profiles
VERTEX_SEARCH_DATASTORE_POLICIES=projects/{project}/locations/global/collections/default_collection/dataStores/platform-policies
VERTEX_SEARCH_DATASTORE_QA=projects/{project}/locations/global/collections/default_collection/dataStores/qa-feedback

# Keep existing
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
```

---

## 7. Integration Points

| System | Integration |
|---|---|
| **Assessment** | On completion → emit `assessment_complete` → clean immediately → index to `freelancer-profiles` + `skill-taxonomy` |
| **Decomposition** | On plan finalized → emit `project_complete` → clean immediately → index to `project-knowledge` |
| **QA Reviews** | On milestone QA → emit `qa_review` → batch clean hourly → index to `qa-feedback` |
| **Matching** | `freelancer-matcher.ts` queries `freelancer-profiles` datastore before scoring |
| **Question Generation** | `generate-skill-question.ts` queries `skill-taxonomy` for patterns |
| **Briefings** | `workspace-briefing.ts` queries `project-knowledge` for related context |
