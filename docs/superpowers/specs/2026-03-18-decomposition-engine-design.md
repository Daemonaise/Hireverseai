# Project Decomposition Engine Revamp — Design Spec

**Goal:** Replace the single-prompt decomposition with a 3-stage pipeline that intelligently breaks projects into milestones and microtasks based on service category, matches freelancers using assessment scores with cost optimization, enforces milestone-based QA gates, and maintains full anonymity between clients and freelancers.

---

## 1. Service Category Taxonomy

Client selects a category before submitting their brief. The decomposition engine uses this to drive role identification, milestone structure, and task generation.

| Category | Key | Typical Roles | Milestone Pattern |
|---|---|---|---|
| Programming & Tech | `programming` | Frontend, Backend, DevOps, Mobile, QA | Architecture → Development → Testing → Deployment |
| Graphics & Design | `design` | UI Designer, Illustrator, Brand Designer, Motion Designer | Concept → Design → Revision → Final Assets |
| Writing & Content | `writing` | Copywriter, Editor, SEO Writer, Technical Writer | Research → Draft → Edit → Final |
| Digital Marketing | `marketing` | SEO Specialist, Ad Manager, Social Media, Email Marketer | Strategy → Setup → Execution → Reporting |
| Video & Animation | `video` | Videographer, Animator, Editor, VFX Artist | Script/Storyboard → Production → Post-Production → Delivery |
| Music & Audio | `music` | Producer, Mixer, Vocalist, Sound Designer | Composition → Production → Mixing → Mastering |
| Business | `business` | Virtual Assistant, Data Analyst, Consultant, PM | Planning → Execution → Review → Delivery |
| Translation & Localization | `translation` | Translator, Proofreader, Localization Engineer | Translation → Review → Localization → QA |
| AI & Data | `ai_data` | ML Engineer, Data Scientist, Prompt Engineer, Annotator | Data Prep → Model/Build → Evaluation → Integration |

Cross-category projects are supported — the AI identifies all relevant categories from the brief and merges milestone patterns.

---

## 2. Decomposition Pipeline

### Stage 1: Project Analysis

AI analyzes the brief + category. Single AI call.

**Input:** `{ projectId, brief, category, clientPriority }`

**Output:**
```typescript
{
  projectType: ServiceCategory[];          // may span multiple categories
  requiredRoles: string[];                 // ["frontend_developer", "ui_designer", "copywriter"]
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedTotalHours: number;
  suggestedMilestoneCount: number;
}
```

### Stage 2: Milestone & Task Generation

AI receives Stage 1 output and generates a structured plan. Single AI call with structured output.

**Output:** Array of milestones, each containing microtasks:

```typescript
{
  milestones: [{
    id: "m1",
    name: "Design Phase",
    order: 1,
    dependencies: [],             // milestone IDs that must complete first
    qaGateEnabled: true,
    tasks: [{
      id: "t1.1",
      description: "Create wireframes for all pages",
      role: "ui_designer",
      requiredSkill: "UI/UX Design",
      minCertificationLevel: "intermediate",
      estimatedHours: 3,
      dependencies: [],           // task IDs within or across milestones
      parallelGroup: "design-1",  // tasks with same group run simultaneously
    }]
  }]
}
```

**Task properties:**
- `role`: What kind of freelancer (maps to assessment skill categories)
- `requiredSkill`: Specific skill from assessment taxonomy
- `minCertificationLevel`: beginner | intermediate | advanced | expert | master
- `estimatedHours`: For cost calculation
- `dependencies`: Task IDs that must complete first
- `parallelGroup`: Tasks in the same group can run simultaneously

### Stage 3: Freelancer Matching & Cost Optimization

Deterministic algorithm (no AI). For each task:

1. Query available freelancers with matching skill where `certificationLevel >= minCertLevel`
2. Apply client priority:
   - **Budget:** Sort by `payRateMultiplier` ascending → cheapest qualified
   - **Quality:** Sort by skill score descending → highest rated
   - **Speed:** Sort by availability + combined score → fastest capable
3. Calculate per-task cost: `estimatedHours × baseRate × payRateMultiplier`
4. Consolidation check: If one freelancer covers multiple roles, prefer them (fewer handoffs, often cheaper)
5. Sum for total project cost

---

## 3. Anonymity System

### Rules

- Client never sees freelancer names, profiles, or real IDs during a project
- Tasks display certification level + role only ("Advanced Developer")
- After project completion, client's history shows anonymized freelancer IDs (e.g., `FL-7829`)
- Same freelancer → same anon ID for the same client (deterministic)
- Different clients see different anon IDs for the same freelancer (hash salted with clientId)
- Freelancers see project ID and brief only — no client names

### Anonymous ID Generation

```
anonId = "FL-" + last4digits(hash(freelancerId + clientId + salt))
```

Deterministic: same freelancer + same client always produces the same anon ID. Different client produces different anon ID.

---

## 4. Client-Facing Project Plan

### Auto-assign threshold

- Projects under $500 estimated cost → auto-assign, work starts immediately
- Projects $500+ → client reviews plan, approves or adjusts

### What the client sees (for $500+ projects)

```
Project: "Bakery Website"
Priority: Budget
Estimated Timeline: 8 days

Milestone 1: Design Phase (3 days)
  ├─ Wireframes & Layout — Advanced Designer — $120
  ├─ Brand Elements — Intermediate Designer — $80
  └─ QA Review (automated)

Milestone 2: Development Phase (4 days, after Design QA)
  ├─ Frontend Build — Advanced Developer — $360
  ├─ Backend API — Advanced Developer — $300 (parallel)
  └─ QA Review (automated)

Milestone 3: Content & Polish (2 days)
  ├─ Website Copy — Intermediate Writer — $100
  └─ Final Review (automated)

Total: $960
```

### Client actions

- Approve as-is → work begins
- Change priority (speed/quality/budget) → engine recalculates
- Remove optional tasks to reduce scope
- Cannot add tasks (change requests handled separately after work starts)
- Cannot select or view specific freelancers

---

## 5. QA Gates

Milestone-boundary QA. When all tasks in a milestone complete:

1. AI reviews all deliverables for that milestone
2. Scores 0-100 with feedback
3. Score ≥ 70 → milestone approved, dependent milestones unblocked
4. Score < 70 → milestone flagged, tasks may be sent back for revision
5. Client notified of milestone completion + summary (no freelancer details)

Uses the same `ai.generate()` grading pattern as the assessment system and `workspace-qa-review.ts`.

---

## 6. Project Status Lifecycle (Updated)

```
pending → planning → awaiting_approval → assigned → milestone_active
       → qa_review → milestone_complete → [next milestone]
       → review → completed
       → change_requested → change_approved
       → cancelled | no_candidates
```

New statuses:
- `planning`: AI is running the 3-stage pipeline
- `awaiting_approval`: Plan shown to client ($500+ projects)
- `milestone_active`: At least one milestone is in progress
- `qa_review`: A milestone's QA gate is being evaluated
- `milestone_complete`: A milestone passed QA

---

## 7. Data Model

### Updated types

```typescript
type ServiceCategory =
  | 'programming' | 'design' | 'writing' | 'marketing'
  | 'video' | 'music' | 'business' | 'translation' | 'ai_data';

type ClientPriority = 'speed' | 'quality' | 'budget';
type ProjectComplexity = 'simple' | 'moderate' | 'complex';
type MilestoneStatus = 'pending' | 'in_progress' | 'qa_review' | 'approved' | 'failed_qa';

// Updated Project
interface Project {
  // existing fields remain
  category: ServiceCategory;
  clientPriority: ClientPriority;
  complexity: ProjectComplexity;
  autoAssigned: boolean;
  estimatedTotalCost: number;
  requiredRoles: string[];
}

// NEW: Milestone
interface Milestone {
  id: string;
  projectId: string;
  name: string;
  order: number;
  status: MilestoneStatus;
  dependencies: string[];
  qaGateEnabled: boolean;
  qaScore?: number;
  qaFeedback?: string;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
}

// Updated Microtask
interface Microtask {
  // existing fields remain
  milestoneId: string;
  role: string;
  requiredSkill: string;
  minCertificationLevel: CertificationLevel;
  parallelGroup: string;
  assignedFreelancerAnonId?: string;
  estimatedCost: number;
  actualCost?: number;
}

// Internal: Freelancer assignment record
interface FreelancerAssignment {
  id: string;
  projectId: string;
  milestoneId: string;
  microtaskId: string;
  freelancerId: string;
  anonId: string;
  skillScore: number;
  certificationLevel: CertificationLevel;
  payRateMultiplier: number;
  estimatedCost: number;
  assignedAt: Timestamp;
}
```

### Firestore structure

```
projects/{projectId}
  ├─ milestones/{milestoneId}         NEW subcollection
  ├─ microtasks/{taskId}              existing, updated schema
  └─ assignments/{assignmentId}       NEW internal subcollection
```

---

## 8. File Map

### New Files

```
src/ai/flows/analyze-project.ts               — Stage 1: project analysis
src/ai/flows/generate-project-plan.ts          — Stage 2: milestone + task generation
src/ai/flows/qa-milestone-review.ts            — QA gate review

src/ai/schemas/analyze-project-schema.ts
src/ai/schemas/generate-project-plan-schema.ts
src/ai/schemas/qa-milestone-review-schema.ts

src/lib/matching/freelancer-matcher.ts         — Stage 3: cost-optimized assignment
src/lib/matching/anon-id.ts                    — Anonymous ID generation
src/lib/matching/cost-calculator.ts            — Per-task and total cost calculation

src/services/milestones.ts                     — Milestone CRUD + status transitions
src/services/assignments.ts                    — FreelancerAssignment CRUD
```

### Modified Files

```
src/ai/flows/decompose-project.ts              — Rewritten to orchestrate 3-stage pipeline
src/ai/schemas/decompose-project-schema.ts     — Updated schemas
src/types/project.ts                           — Add category, priority, milestone types
src/services/firestore.ts                      — Add milestone/assignment operations
src/components/client-dashboard.tsx            — Show project plan with anonymized info
```

---

## 9. Integration Points

| System | Connection |
|---|---|
| **Assessment** | `freelancer-matcher.ts` reads `certificationLevel`, `skillScores`, `payRateMultiplier` from assessment results |
| **Match Freelancer flow** | Still used for simple single-freelancer matches. Complex multi-role projects use the new pipeline. |
| **Workspace QA Review** | `qa-milestone-review.ts` uses same grading pattern |
| **Hub Activity** | Milestone completions and QA results appear in workspace activity timeline |
| **Messaging** | Freelancers communicate per-workspace, never seeing client identity |

---

## 10. Data Collection & Analytics Pipeline

Every project generates signals that improve the platform over time. Data collection is built into the decomposition and execution pipeline — not bolted on after.

### 10.1 Event Types

Events are stored in a `projects/{projectId}/events` Firestore subcollection. Each event is a timestamped record:

| Event | Source | Data Collected | Used For |
|---|---|---|---|
| `project_created` | Client | category, priority, brief length, skill count | Demand forecasting |
| `decomposition_complete` | Pipeline | complexity, milestone count, task count, total estimated hours, total estimated cost, roles identified | Estimate accuracy tracking |
| `freelancer_matched` | Matcher | task ID, freelancer cert level, pay multiplier, skill score, priority used | Match quality analysis |
| `task_started` | Freelancer | task ID, actual start time | Time-to-start metrics |
| `task_submitted` | Freelancer | task ID, actual hours spent, submission time | Estimate vs actual comparison |
| `qa_milestone_reviewed` | QA Gate | milestone ID, score, pass/fail, revision count | Quality metrics |
| `task_revised` | Freelancer | task ID, revision number, reason | Quality issue tracking |
| `milestone_completed` | System | milestone ID, actual duration vs estimated | Timeline accuracy |
| `project_completed` | System | total actual cost, total actual hours, final QA score, client priority achieved | ROI analysis |
| `change_requested` | Client | description, estimated impact cost | Scope creep tracking |

### 10.2 Derived Metrics (computed from events)

Stored on the freelancer profile and updated after each project:

| Metric | How it's computed | Used for |
|---|---|---|
| `estimateAccuracy` | avg(actual_hours / estimated_hours) across all tasks | Improving AI estimates |
| `qualityScore` | weighted avg of QA scores across milestones | Matching quality signal |
| `revisionRate` | revisions / total tasks submitted | Reliability indicator |
| `onTimeRate` | % of tasks completed within estimated time | Speed signal |
| `clientSatisfactionProxy` | composite of QA scores + low change request rate + project completion | Overall freelancer rating |

Stored on projects for platform analytics:

| Metric | How it's computed | Used for |
|---|---|---|
| `costEfficiency` | estimated_cost / actual_cost | Pricing model tuning |
| `timeEfficiency` | estimated_duration / actual_duration | Timeline model tuning |
| `matchQuality` | avg freelancer skill score for assigned tasks / max available | Matcher optimization |

### 10.3 Storage Strategy (cost-effective)

```
Firestore (hot data, real-time):
  projects/{id}/events/{eventId}     — Raw events during active projects
  freelancers/{id}/performanceStats  — Derived metrics (single document, updated on project close)

BigQuery (cold analytics, batch):
  Firestore → BigQuery scheduled export (daily)
  — Full event history for ML training
  — Cross-project analytics
  — Demand forecasting
  — Pricing optimization models
```

Cost: Firestore export to BigQuery is ~$0.01/GB. Events are small (~500 bytes each). A project with 20 tasks generates ~100 events ≈ 50KB. At 1000 projects/month = 50MB/month = pennies.

### 10.4 Security

- Events subcollection is write-only from server-side (no client reads)
- Performance stats on freelancer profiles are read-only by the matching engine
- BigQuery access is restricted to service account (no client/freelancer access)
- Anonymous IDs in events — freelancer IDs are present but never exposed via client-facing queries
- Firestore security rules: clients can read their own project events but not freelancer IDs within them

### 10.5 Data Files

```
src/services/project-events.ts        — Event recording service
src/lib/analytics/performance-stats.ts — Compute derived metrics from events
```

---

## 11. Security Hardening

### 11.1 API Route Protection

All API routes that touch the decomposition pipeline require authentication:

| Route | Protection |
|---|---|
| Decompose project | `verifyAuthToken` + verify `clientId` matches authenticated user |
| Approve project plan | `verifyAuthToken` + verify project belongs to client |
| Get project assignments | `verifyAuthToken` + strip `freelancerId` from response (anonymity) |
| Milestone QA trigger | Server-only (not client-callable) |

### 11.2 Firestore Security Rules

```
projects/{projectId}:
  - read: client who owns the project OR assigned freelancers
  - write: server-only (via admin or server actions)

projects/{projectId}/assignments:
  - read: server-only (NEVER client-readable)
  - write: server-only

projects/{projectId}/events:
  - read: server-only (analytics pipeline)
  - write: server-only

freelancers/{fid}/performanceStats:
  - read: server-only (matching engine)
  - write: server-only
```

### 11.3 Data Isolation

- Clients never see: freelancer real IDs, other clients' projects, assignment internals
- Freelancers never see: client names, other freelancers on the same project, payment details
- Anonymous IDs are the only cross-reference visible to either side
- The matching engine runs server-side only — no client-side access to the candidate pool

---

## 12. Out of Scope

- Client-facing freelancer selection (by design — anonymity)
- Real-time task progress streaming
- Freelancer availability/calendar integration
- Escrow/payment splitting per milestone (Stripe integration for this is a separate spec)
- Admin dashboard for managing assignments
