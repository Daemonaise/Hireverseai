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

## 10. Out of Scope

- Client-facing freelancer selection (by design — anonymity)
- Real-time task progress streaming
- Freelancer availability/calendar integration
- Escrow/payment splitting per milestone (Stripe integration for this is a separate spec)
- Admin dashboard for managing assignments
