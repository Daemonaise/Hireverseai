# Adaptive Assessment Revamp — Design Spec

**Goal:** Replace the current text-only adaptive assessment with a comprehensive 45-60 minute assessment that measures skill proficiency across Fiverr-scale categories, cognitive ability (IQ estimation) via procedurally generated visual puzzles and 3D spatial tasks, and includes behavioral anti-cheat proctoring. Assessment results determine certification level and pay rate multiplier (0.5x - 2.5x).

**Depends on:** Framer Motion (already installed), React Three Fiber (new dep for 3D spatial tasks).

---

## 1. Assessment Structure

Three-phase assessment, ~45-60 minutes total. Treated as a paid interview — freelancers earn pay rates proportional to their scores and can retest with a 7-day cooldown.

| Phase | Duration | Questions | Measures |
|---|---|---|---|
| **1. Skill Proficiency** | 25-35 min | 20-25 questions | Domain expertise in declared skills |
| **2. Cognitive Battery** | 15-20 min | 15-20 questions | Pattern recognition, numerical, verbal, spatial, logical, working memory |
| **3. Practical Challenge** | 5-10 min | 1-2 tasks | Applied problem-solving in their domain |

### Adaptive Difficulty

Five levels: `beginner → intermediate → advanced → expert → master`

Each domain tracks difficulty independently. Algorithm per answer:
- Score ≥ 85 → harder
- Score 40-84 → same
- Score < 40 → easier

**Ceiling detection:** 2 consecutive failures at the same level → lock that domain's difficulty, move on.

**Floor detection:** 3 consecutive aces at expert+ → push to master (trick questions, edge cases, ambiguity).

---

## 2. Phase 1: Skill Proficiency (25-35 min)

AI dynamically generates domain-appropriate questions for the freelancer's declared skills. Every question is unique per session (seeded from `freelancerId + timestamp`).

### Question Types by Skill Category

| Category | Question Types |
|---|---|
| **Programming/Tech** | Code output prediction, debug snippet, system design scenario, algorithm choice, "what's wrong with this code", function signature design |
| **Design/Creative** | Layout critique (describe flaws), color theory, typography pairing, UX flow analysis, design principle application |
| **Writing/Content** | Rewrite paragraph, tone/voice identification, headline A/B with reasoning, SEO strategy, grammar/style correction |
| **Marketing** | Campaign strategy, audience targeting, funnel optimization, metric interpretation, A/B test analysis |
| **Video/Animation** | Storyboard sequencing, transition choice, pacing analysis, format knowledge, motion design principles |
| **Music/Audio** | Mixing scenario, frequency identification, arrangement critique, format/bitrate knowledge, production workflow |
| **Business/Admin** | Process optimization, data interpretation, communication drafting, prioritization scenario, stakeholder management |
| **Translation** | Nuance preservation, idiom handling, register appropriateness, back-translation verification |

### How It Works

1. AI receives: freelancer's declared skills, current difficulty level, previously asked questions
2. AI generates scenario-based question with realistic artifacts (code snippets, data tables, client briefs)
3. Freelancer types answer (10+ characters, paste disabled)
4. AI grades: 0-100 score + feedback + flags + next difficulty suggestion
5. Difficulty adjusts per adaptive algorithm
6. Multi-skill rotation — if freelancer declared 4 skills, questions rotate across all of them
7. After 20-25 questions, transition to cognitive battery

---

## 3. Phase 2: Cognitive Battery (15-20 min)

Six cognitive domains, each tested with 2-4 questions that adapt independently. Visual puzzles are procedurally generated SVG — no external APIs. Cognitive domains are weighted toward the freelancer's skill category (e.g., designers get more spatial, programmers get more logical) but all 6 domains are tested for every freelancer.

### 3.1 Pattern Recognition (Raven's-style Matrices)

Procedural SVG generator creates a 3x3 grid. Shapes follow transformation rules (rotation, color shift, size change, shape morphing, element count). The 9th cell is missing — freelancer picks from 6 options.

**Difficulty scaling:**
- Easy: 1 rule (e.g., rotation only)
- Medium: 2 rules combined
- Hard: 3 rules + distractor options that satisfy only 1-2 rules
- Expert: Overlapping rule systems
- Master: Nested rules (rule applied to the rule pattern itself)

**Implementation:** `src/lib/puzzles/matrix-generator.ts` — outputs SVG string from a seed + difficulty config.

### 3.2 Numerical Reasoning

Number sequences and data interpretation. Text-based.

- Easy: Simple arithmetic sequences
- Medium: Data table interpretation, trend identification
- Hard: Multi-step word problems with percentages, ratios, compound operations
- Expert: Statistical reasoning, probability
- Master: Problems with missing information requiring identification of what's missing

### 3.3 Verbal Reasoning

Analogies, logical deduction from passages, inference.

- Easy: Simple analogies
- Medium: Short paragraph inference
- Hard: Logical fallacy identification, syllogisms
- Expert: Complex argument analysis
- Master: Ambiguous passages requiring nuanced interpretation

### 3.4 Spatial Reasoning (React Three Fiber)

3D mental rotation tasks. Show two 3D block structures — freelancer determines if they're the same shape rotated, or mirror images.

**Implementation:** `src/components/assessment/spatial-viewer.tsx` using `@react-three/fiber` + `@react-three/drei`. Procedurally generated block structures from seed. Orbit controls disabled.

**Difficulty scaling:**
- Easy: Simple L-shapes, 2-3 blocks
- Medium: 4-5 blocks, one-axis rotation
- Hard: 6+ blocks, multi-axis rotation
- Expert: Very similar but subtly different structures
- Master: Compound shapes with internal cavities

### 3.5 Logical Deduction

Rule-based puzzles.

- Easy: Simple if/then chains
- Medium: 3-4 variable constraint puzzles
- Hard: Truth table completion, logic grid puzzles
- Expert: Multi-step deduction with negation
- Master: Paradox identification, incomplete information reasoning

### 3.6 Working Memory (Sequence Recall)

Interactive — show a sequence of items (numbers, colors, grid positions) for a brief time, then ask for recall.

**Implementation:** Animated sequence display (Framer Motion), then input field. Timer-based — sequence disappears after display.

**Difficulty scaling:**
- Easy: 4 items, 3 seconds
- Medium: 6 items, 4 seconds
- Hard: 8 items, 5 seconds
- Expert: 10 items, 5 seconds
- Master: 10+ items with interference (distractor task between display and recall)

---

## 4. Phase 3: Practical Challenge (5-10 min)

1-2 open-ended tasks in the freelancer's primary skill domain. AI-generated scenario with a concrete deliverable request. Graded on quality, creativity, and completeness. This phase tests applied ability, not just knowledge.

Examples:
- **Programmer:** "Given this API spec, write the Express route handler for..."
- **Designer:** "A client sends you this brief. Describe your design approach, layout, and color rationale."
- **Writer:** "Write the opening 200 words of a blog post for this SaaS product targeting..."
- **Marketer:** "This e-commerce store has 10K monthly visitors but 0.5% conversion. Propose 3 changes and explain why."

---

## 5. Anti-Cheat + Behavioral Proctoring

### 5.1 Behavioral Signals (collected passively via `useProctor()` hook)

| Signal | Method | Red Flag Threshold |
|---|---|---|
| Tab visibility | `document.visibilitychange` | 5+ switches or 30s+ total away |
| Window blur | `window.blur/focus` | Combined with tab visibility |
| Copy-paste | Block paste, log attempts | Any attempt logged |
| Typing cadence | Keystroke interval analysis | Unnaturally consistent timing or long pause → rapid perfect text |
| Answer timing | Time per question | < 5s on hard question, or > 10 min on easy |
| Mouse exits | Mouse leaves viewport | 10+ exits during single question |
| Right-click | Disable context menu, log | Log only |
| DevTools | F12 / Ctrl+Shift+I / resize detection | Flag session |

### 5.2 Answer Analysis (server-side, per answer)

AI grader flags: `ai_generated_suspected`, `plagiarized_suspected`, `irrelevant`, `too_short`, `profane`, `timing_anomaly`, `cadence_anomaly`, `consistency_check`.

**Consistency check:** If freelancer scores Master on easy questions but fails beginner follow-ups → flag inconsistency.

### 5.3 Session Integrity Score

Behavioral signals aggregated into `sessionIntegrity` (0-100):
- 90-100: Clean — scores kept
- 70-89: Minor flags — scores kept, note added
- 50-69: Moderate flags — scores kept but marked "unverified", may require retest
- < 50: Session invalidated — must retest

### 5.4 Unique Question Generation

Every session seeded from `freelancerId + timestamp`. No two freelancers get the same questions. SVG puzzles use seed for procedural generation. AI text questions include `previousQuestions` array.

---

## 6. Scoring

### 6.1 Skill Score

Weighted average of all skill proficiency question scores by difficulty:
- Beginner: 0.6x weight
- Intermediate: 0.8x
- Advanced: 1.0x
- Expert: 1.2x
- Master: 1.5x

Per-skill scores stored individually.

### 6.2 Cognitive Profile + IQ Estimation

Each domain gets a 0-100 raw score (same weighted formula). Composite IQ is a weighted average:

| Domain | Weight | Rationale |
|---|---|---|
| Pattern recognition | 25% | Strongest g-factor correlate |
| Logical deduction | 20% | Core analytical ability |
| Numerical reasoning | 15% | Quantitative capacity |
| Verbal reasoning | 15% | Communication + comprehension |
| Spatial reasoning | 15% | Visual-spatial intelligence |
| Working memory | 10% | Processing capacity |

**IQ mapping (raw composite → IQ scale):**

| Raw Score | Estimated IQ | Percentile |
|---|---|---|
| 95-100 | 140+ | 99.6th |
| 85-94 | 125-139 | 95th-99th |
| 70-84 | 110-124 | 75th-95th |
| 50-69 | 90-109 | 25th-75th |
| 30-49 | 75-89 | 5th-25th |
| < 30 | < 75 | < 5th |

### 6.3 Pay Rate Multiplier

```
skillWeight = 0.65
cogWeight   = 0.35
compositeScore = (avgSkillScore * skillWeight) + (avgCognitiveScore * cogWeight)

Multiplier:
  compositeScore >= 95  →  2.5x
  compositeScore >= 85  →  2.0x
  compositeScore >= 75  →  1.5x
  compositeScore >= 65  →  1.2x
  compositeScore >= 50  →  1.0x (base rate)
  compositeScore >= 35  →  0.75x
  compositeScore <  35  →  0.5x
```

### 6.4 Certification Level

| Level | Composite | Badge |
|---|---|---|
| Master | 95+ | Gold diamond |
| Expert | 85-94 | Purple diamond |
| Advanced | 75-84 | Blue diamond |
| Intermediate | 50-74 | Green diamond |
| Beginner | 35-49 | Gray diamond |
| Uncertified | < 35 | No badge |

### 6.5 Retest Policy

- Retest anytime, new assessment replaces old (no cherry-picking)
- 7-day cooldown between attempts
- Full history kept in Firestore for improvement tracking

---

## 7. Data Model

```typescript
type CertificationLevel = 'master' | 'expert' | 'advanced' | 'intermediate' | 'beginner' | 'uncertified';
type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'master';
type AnswerFlag = 'ai_generated_suspected' | 'plagiarized_suspected' | 'irrelevant' | 'too_short' | 'profane' | 'timing_anomaly' | 'cadence_anomaly' | 'consistency_check';
type CognitiveDomain = 'patternRecognition' | 'numericalReasoning' | 'verbalReasoning' | 'spatialReasoning' | 'logicalDeduction' | 'workingMemory';

interface AssessmentResult {
  id: string;
  freelancerId: string;
  attemptNumber: number;

  // Phase 1
  skillScores: Record<string, number>;           // skill → 0-100

  // Phase 2
  cognitiveProfile: Record<CognitiveDomain, number>;  // domain → 0-100
  estimatedIQ: number;                            // IQ scale (mean 100, SD 15)

  // Phase 3
  practicalScore: number;                         // 0-100

  // Combined
  compositeScore: number;                         // 0-100
  certificationLevel: CertificationLevel;
  payRateMultiplier: number;                      // 0.5 - 2.5

  // Integrity
  sessionIntegrity: number;                       // 0-100
  behavioralFlags: string[];

  // Questions
  questions: AssessmentQuestionAnswer[];

  // Meta
  startedAt: Timestamp;
  completedAt: Timestamp;
  durationSeconds: number;
}

interface AssessmentQuestionAnswer {
  questionId: string;
  phase: 1 | 2 | 3;
  domain: string;                                 // skill name or cognitive domain
  questionType: string;                           // 'text' | 'matrix' | 'spatial' | 'sequence' | 'practical'
  questionText: string;
  questionData?: string;                          // SVG string, 3D seed, or other structured data
  answerOptions?: string[];                       // For multiple choice (matrix puzzles)
  answer: string;
  score: number;
  maxScore: number;
  difficulty: DifficultyLevel;
  feedback: string;
  flags: AnswerFlag[];
  timeSpentSeconds: number;
  answeredAt: Timestamp;
}
```

---

## 8. File Map

### New Dependencies

```
@react-three/fiber    — React renderer for Three.js (3D spatial tasks)
@react-three/drei     — Helper components for R3F (OrbitControls, etc.)
three                 — Three.js (peer dep of R3F)
```

### New Files

```
src/lib/puzzles/
  matrix-generator.ts           — Raven's-style SVG puzzle generation
  sequence-generator.ts         — Number/pattern sequence generation
  block-structure.ts            — 3D block structure generation for spatial

src/lib/assessment/
  proctor.ts                    — Behavioral signal collector
  integrity-scorer.ts           — Signal → session integrity score
  scoring.ts                    — Composite score, IQ estimation, pay rate calc
  difficulty-engine.ts          — Adaptive difficulty state machine

src/hooks/
  use-proctor.ts                — React hook for proctoring event listeners

src/components/assessment/
  assessment-shell.tsx          — Main 3-phase assessment container
  phase-indicator.tsx           — Progress bar showing current phase + question count
  skill-question.tsx            — Text-based skill question renderer
  cognitive-question.tsx        — Router for cognitive question types
  matrix-puzzle.tsx             — SVG matrix puzzle with answer options
  spatial-viewer.tsx            — React Three Fiber 3D rotation comparison
  sequence-recall.tsx           — Timed sequence display + recall
  practical-challenge.tsx       — Open-ended practical task
  assessment-results.tsx        — Score breakdown display with certification
  timer-bar.tsx                 — Per-question countdown timer

src/ai/flows/
  generate-skill-question.ts   — Replaces current generate-assessment-question
  grade-skill-answer.ts        — Replaces current grade-assessment-answer
  generate-practical-challenge.ts — Phase 3 challenge generation
  grade-practical-answer.ts    — Phase 3 grading

src/ai/schemas/
  skill-question-schema.ts
  skill-answer-schema.ts
  practical-challenge-schema.ts
  practical-answer-schema.ts

src/types/assessment.ts         — Updated with new types (replaces current)
```

### Modified Files

```
src/components/adaptive-skill-assessment.tsx   — Replaced by assessment-shell.tsx
src/components/freelancer-signup-form.tsx       — Updated to use new assessment
src/services/firestore.ts                      — Updated storeAssessmentResult for new data model
```

---

## 9. Out of Scope

- Camera/screen recording proctoring
- Real-time multiplayer assessment
- Assessment question bank curation UI (admin panel)
- Localization of assessment questions (English only for now)
- Mobile-optimized assessment (desktop-first, 3D tasks need mouse)
