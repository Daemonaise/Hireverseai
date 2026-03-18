# Gamification Engine Implementation Plan (Plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Firebase Cloud Functions v2 gamification engine with Firestore triggers that awards XP, badges, levels, and streaks based on platform events, plus client-side components for displaying progress and notifications.

**Architecture:** Cloud Functions (gen2, Node.js 20) with Firebase Admin SDK. Firestore document triggers fire rule pipeline that reads freelancer state, computes rewards, and batch-writes XP/badges/level/notifications back to Firestore. Client reads via React Query hooks and real-time `onSnapshot` listeners.

**Tech Stack:** Firebase Cloud Functions v2, Firebase Admin SDK, TypeScript, Firestore, React 19, React Query, shadcn/ui, Framer Motion, Lucide icons.

**Spec:** `docs/superpowers/specs/2026-03-18-gamification-community-design.md` (Sections 0, 1, 4.1-4.5)

**Depends on:** Nothing (this is the foundation)
**Blocks:** Plan 2 (Reputation), Plan 3 (Community Hub)

---

## File Map

### New Files - Cloud Functions (`functions/`)
| File | Responsibility |
|------|---------------|
| `functions/package.json` | Dependencies: firebase-functions, firebase-admin, typescript |
| `functions/tsconfig.json` | TypeScript config for Cloud Functions |
| `functions/src/index.ts` | Export all trigger functions |
| `functions/src/gamification/engine.ts` | `processEvent()` - central rule pipeline |
| `functions/src/gamification/levels.ts` | Level thresholds, `computeLevel(xp)` |
| `functions/src/gamification/badges.ts` | Full badge registry (~20 badges) |
| `functions/src/gamification/rules/project-rules.ts` | Task/project completion rewards |
| `functions/src/gamification/rules/streak-rules.ts` | Streak tracking + rewards |
| `functions/src/gamification/rules/milestone-rules.ts` | Level/earnings milestone badges |
| `functions/src/gamification/types.ts` | Shared types: GamificationEvent, Reward, FreelancerStats |
| `functions/src/triggers/on-project-completed.ts` | Projects status -> completed trigger |
| `functions/src/triggers/on-task-approved.ts` | Microtask status -> approved trigger |
| `functions/src/triggers/on-assessment-completed.ts` | Assessment fields updated trigger |
| `functions/src/triggers/on-presence-update.ts` | Presence heartbeat -> streak tracking |
| `functions/src/utils/firestore.ts` | Admin SDK init + helpers |
| `functions/src/utils/notifications.ts` | `writeNotification()` + `writePublicActivity()` |
| `functions/src/scripts/backfill-stats.ts` | One-time migration script |

### New Files - Client (`src/`)
| File | Responsibility |
|------|---------------|
| `src/types/gamification.ts` | FreelancerStats, Notification, PublicActivity types |
| `src/hooks/use-freelancer-stats.ts` | React Query hook for freelancerStats |
| `src/hooks/use-notifications.ts` | Real-time onSnapshot hook for notifications |
| `src/components/gamification/xp-progress-card.tsx` | Level + XP bar + streak + recent badges |
| `src/components/gamification/badge-grid.tsx` | Earned + locked badge display |
| `src/components/notification-bell.tsx` | Header notification icon + dropdown |

### New Files - Config
| File | Responsibility |
|------|---------------|
| `firebase.json` | Firebase project config (functions + firestore) |
| `.firebaserc` | Firebase project ID |

### Modified Files
| File | Change |
|------|--------|
| `src/types/badge.ts` | Replace 5-badge registry with ~20 badges, add rarity/category/iconName |
| `src/services/firestore.ts` | Remove `awardXp`, `awardBadge`, refactor `storeAssessmentResult` |
| `src/app/globals.css` | Add rarity CSS custom properties |
| `src/types/freelancer.ts` | Add `level`, `levelTitle` fields |

---

## Task 1: Firebase Project Setup

**Files:**
- Create: `firebase.json`
- Create: `.firebaserc`
- Create: `functions/package.json`
- Create: `functions/tsconfig.json`

- [ ] **Step 1: Create firebase.json**

```json
{
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "ignore": ["node_modules", ".git"],
      "predeploy": ["npm --prefix \"$RESOURCE_DIR\" run build"]
    }
  ],
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  }
}
```

- [ ] **Step 2: Create .firebaserc**

```json
{
  "projects": {
    "default": "INSERT_PROJECT_ID"
  }
}
```

Note: The implementer must replace `INSERT_PROJECT_ID` with the actual Firebase project ID from `NEXT_PUBLIC_FIREBASE_PROJECT_ID` in `.env`.

- [ ] **Step 3: Create functions/package.json**

```json
{
  "name": "hireverse-functions",
  "private": true,
  "main": "lib/index.js",
  "scripts": {
    "build": "tsc",
    "serve": "npm run build && firebase emulators:start --only functions",
    "deploy": "firebase deploy --only functions"
  },
  "engines": {
    "node": "20"
  },
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^5.0.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/node": "^20.0.0"
  }
}
```

- [ ] **Step 4: Create functions/tsconfig.json**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "noImplicitReturns": true,
    "noUnusedLocals": false,
    "outDir": "lib",
    "rootDir": "src",
    "sourceMap": true,
    "strict": true,
    "target": "es2022",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "compileOnSave": true,
  "include": ["src"]
}
```

- [ ] **Step 5: Install functions dependencies**

```bash
cd functions && npm install && cd ..
```

- [ ] **Step 6: Commit**

```bash
git add firebase.json .firebaserc functions/package.json functions/tsconfig.json functions/package-lock.json
git commit -m "feat: initialize Firebase Cloud Functions project structure"
```

---

## Task 2: Gamification Types + Levels + Badges

**Files:**
- Create: `functions/src/gamification/types.ts`
- Create: `functions/src/gamification/levels.ts`
- Create: `functions/src/gamification/badges.ts`

- [ ] **Step 1: Create shared types**

```typescript
// functions/src/gamification/types.ts
import { Timestamp } from 'firebase-admin/firestore';

export type GamificationEventType =
  | 'task_approved'
  | 'project_completed'
  | 'review_received'
  | 'assessment_completed'
  | 'community_post'
  | 'community_vote'
  | 'presence_update';

export interface GamificationEvent {
  type: GamificationEventType;
  freelancerId: string;
  metadata: Record<string, any>;
}

export interface Reward {
  type: 'xp' | 'badge' | 'level_up' | 'streak';
  xp?: number;
  badgeId?: string;
  newLevel?: number;
  newTitle?: string;
  streakDays?: number;
  description: string;
}

export interface FreelancerStats {
  xp: number;
  level: number;
  levelTitle: string;
  xpToNextLevel: number;
  badges: string[];
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string;
  tasksCompleted: number;
  projectsCompleted: number;
  perfectScores: number;
  consecutiveOnTime: number;
  consecutiveZeroRevisions: number;
  totalEarned: number;
  reviewAverage: number;
  reviewCount: number;
  categoryAverages: {
    quality: number;
    communication: number;
    timeliness: number;
    expertise: number;
  };
  dailyCommunityXp: number;
  dailyCommunityXpDate: string;
  updatedAt: Timestamp | null;
}

export const DEFAULT_STATS: Omit<FreelancerStats, 'updatedAt'> = {
  xp: 0,
  level: 1,
  levelTitle: 'Newcomer',
  xpToNextLevel: 200,
  badges: [],
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDate: '',
  tasksCompleted: 0,
  projectsCompleted: 0,
  perfectScores: 0,
  consecutiveOnTime: 0,
  consecutiveZeroRevisions: 0,
  totalEarned: 0,
  reviewAverage: 0,
  reviewCount: 0,
  categoryAverages: { quality: 0, communication: 0, timeliness: 0, expertise: 0 },
  dailyCommunityXp: 0,
  dailyCommunityXpDate: '',
};
```

- [ ] **Step 2: Create levels module**

```typescript
// functions/src/gamification/levels.ts

interface LevelInfo {
  level: number;
  title: string;
  xpToNextLevel: number;
}

const LEVEL_THRESHOLDS = [
  { level: 1, title: 'Newcomer', cumulative: 0 },
  { level: 2, title: 'Apprentice', cumulative: 200 },
  { level: 3, title: 'Journeyman', cumulative: 700 },
  { level: 4, title: 'Specialist', cumulative: 1700 },
  { level: 5, title: 'Expert', cumulative: 3700 },
  { level: 6, title: 'Master', cumulative: 7700 },
  { level: 7, title: 'Grandmaster', cumulative: 15700 },
  { level: 8, title: 'Legend', cumulative: 31700 },
];

export function computeLevel(xp: number): LevelInfo {
  let current = LEVEL_THRESHOLDS[0];

  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i].cumulative) {
      current = LEVEL_THRESHOLDS[i];
      break;
    }
  }

  const nextIndex = LEVEL_THRESHOLDS.findIndex((t) => t.level === current.level + 1);
  const xpToNextLevel = nextIndex >= 0
    ? LEVEL_THRESHOLDS[nextIndex].cumulative - xp
    : 0; // Max level

  return {
    level: current.level,
    title: current.title,
    xpToNextLevel: Math.max(0, xpToNextLevel),
  };
}
```

- [ ] **Step 3: Create badge registry**

```typescript
// functions/src/gamification/badges.ts

export type BadgeRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type BadgeCategory = 'onboarding' | 'projects' | 'quality' | 'community' | 'streaks' | 'milestones';

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  category: BadgeCategory;
  iconName: string;
  rarity: BadgeRarity;
}

export const BADGE_REGISTRY: Record<string, BadgeDef> = {
  // Onboarding
  'onboarding-complete': { id: 'onboarding-complete', name: 'Assessment Complete', description: 'Complete the skill assessment', category: 'onboarding', iconName: 'GraduationCap', rarity: 'common' },
  'profile-complete': { id: 'profile-complete', name: 'Profile Complete', description: 'Fill out all profile fields', category: 'onboarding', iconName: 'UserCheck', rarity: 'common' },
  'first-connection': { id: 'first-connection', name: 'First Connection', description: 'Connect your first external tool', category: 'onboarding', iconName: 'Link', rarity: 'common' },

  // Projects
  'first-task': { id: 'first-task', name: 'First Task', description: 'Complete your first task', category: 'projects', iconName: 'CheckCircle', rarity: 'common' },
  'task-10': { id: 'task-10', name: 'Task Veteran', description: 'Complete 10 tasks', category: 'projects', iconName: 'ListChecks', rarity: 'uncommon' },
  'task-50': { id: 'task-50', name: 'Task Master', description: 'Complete 50 tasks', category: 'projects', iconName: 'Layers', rarity: 'rare' },
  'task-100': { id: 'task-100', name: 'Century Club', description: 'Complete 100 tasks', category: 'projects', iconName: 'Crown', rarity: 'epic' },
  'first-five-star': { id: 'first-five-star', name: 'Five Stars', description: 'Receive your first 5-star review', category: 'projects', iconName: 'Star', rarity: 'uncommon' },

  // Quality
  'qa-perfect': { id: 'qa-perfect', name: 'QA Perfect', description: 'Score 100/100 on a QA check', category: 'quality', iconName: 'ShieldCheck', rarity: 'uncommon' },
  'zero-revisions-5': { id: 'zero-revisions-5', name: 'Flawless Five', description: '5 consecutive tasks with zero revisions', category: 'quality', iconName: 'Sparkles', rarity: 'rare' },
  'on-time-10': { id: 'on-time-10', name: 'On-Time Champion', description: '10 consecutive on-time deliveries', category: 'quality', iconName: 'Clock', rarity: 'rare' },

  // Community
  'first-post': { id: 'first-post', name: 'First Post', description: 'Create your first community post', category: 'community', iconName: 'MessageSquare', rarity: 'common' },
  'helpful-10': { id: 'helpful-10', name: 'Helpful', description: 'Receive 10 upvotes', category: 'community', iconName: 'ThumbsUp', rarity: 'uncommon' },
  'mentor-50': { id: 'mentor-50', name: 'Mentor', description: 'Write 50 community replies', category: 'community', iconName: 'Heart', rarity: 'rare' },

  // Streaks
  'streak-7': { id: 'streak-7', name: 'Week Warrior', description: '7-day activity streak', category: 'streaks', iconName: 'Flame', rarity: 'common' },
  'streak-30': { id: 'streak-30', name: 'Monthly Grind', description: '30-day activity streak', category: 'streaks', iconName: 'Flame', rarity: 'uncommon' },
  'streak-100': { id: 'streak-100', name: 'Unstoppable', description: '100-day activity streak', category: 'streaks', iconName: 'Flame', rarity: 'epic' },

  // Milestones
  'level-5': { id: 'level-5', name: 'Expert Status', description: 'Reach Level 5', category: 'milestones', iconName: 'Award', rarity: 'rare' },
  'level-8': { id: 'level-8', name: 'Legendary', description: 'Reach Level 8', category: 'milestones', iconName: 'Trophy', rarity: 'legendary' },
  'earned-10k': { id: 'earned-10k', name: '$10K Club', description: 'Earn $10,000 cumulative', category: 'milestones', iconName: 'DollarSign', rarity: 'rare' },
  'earned-50k': { id: 'earned-50k', name: '$50K Club', description: 'Earn $50,000 cumulative', category: 'milestones', iconName: 'Banknote', rarity: 'epic' },
};
```

- [ ] **Step 4: Verify functions compile**

```bash
cd functions && npx tsc --noEmit && cd ..
```

- [ ] **Step 5: Commit**

```bash
git add functions/src/gamification/
git commit -m "feat: add gamification types, levels, and badge registry"
```

---

## Task 3: Engine Core + Utils

**Files:**
- Create: `functions/src/utils/firestore.ts`
- Create: `functions/src/utils/notifications.ts`
- Create: `functions/src/gamification/engine.ts`

- [ ] **Step 1: Create Admin SDK helper**

```typescript
// functions/src/utils/firestore.ts
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp();
export const db = getFirestore(app);
```

- [ ] **Step 2: Create notification helper**

```typescript
// functions/src/utils/notifications.ts
import { db } from './firestore';
import { FieldValue } from 'firebase-admin/firestore';

interface NotificationData {
  type: 'xp_earned' | 'badge_earned' | 'level_up' | 'streak' | 'review_received';
  title: string;
  body: string;
  metadata?: Record<string, any>;
}

export async function writeNotification(userId: string, data: NotificationData): Promise<void> {
  await db.collection('notifications').doc(userId).collection('items').add({
    ...data,
    metadata: data.metadata ?? {},
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function writePublicActivity(
  freelancerId: string,
  freelancerName: string,
  type: 'level_up' | 'badge_earned' | 'streak_milestone',
  title: string,
  description: string,
): Promise<void> {
  await db.collection('publicActivity').add({
    freelancerId,
    freelancerName,
    type,
    title,
    description,
    createdAt: FieldValue.serverTimestamp(),
  });
}
```

- [ ] **Step 3: Create the gamification engine**

```typescript
// functions/src/gamification/engine.ts
import { db } from '../utils/firestore';
import { writeNotification, writePublicActivity } from '../utils/notifications';
import { computeLevel } from './levels';
import { BADGE_REGISTRY } from './badges';
import { DEFAULT_STATS, type FreelancerStats, type GamificationEvent, type Reward } from './types';
import { getProjectRules } from './rules/project-rules';
import { getStreakRules } from './rules/streak-rules';
import { getMilestoneRules } from './rules/milestone-rules';
import { FieldValue } from 'firebase-admin/firestore';

export async function processEvent(event: GamificationEvent): Promise<Reward[]> {
  const statsRef = db.collection('freelancerStats').doc(event.freelancerId);
  const freelancerRef = db.collection('freelancers').doc(event.freelancerId);

  // 1. Read current stats (create if missing)
  const statsSnap = await statsRef.get();
  const stats: FreelancerStats = statsSnap.exists
    ? (statsSnap.data() as FreelancerStats)
    : { ...DEFAULT_STATS, updatedAt: null };

  // 2. Collect rewards from all matching rules
  const rewards: Reward[] = [];

  const allRules = [
    ...getProjectRules(event, stats),
    ...getStreakRules(event, stats),
    ...getMilestoneRules(event, stats),
  ];

  rewards.push(...allRules);

  // 3. Compute new XP total
  const xpGained = rewards.reduce((sum, r) => sum + (r.xp ?? 0), 0);
  if (xpGained === 0 && rewards.length === 0) return [];

  const newXp = stats.xp + xpGained;

  // 4. Check for level-up
  const levelInfo = computeLevel(newXp);
  if (levelInfo.level > stats.level) {
    rewards.push({
      type: 'level_up',
      newLevel: levelInfo.level,
      newTitle: levelInfo.title,
      description: `Reached Level ${levelInfo.level} - ${levelInfo.title}`,
    });
  }

  // 5. Filter out already-earned badges
  const newBadges = rewards
    .filter((r) => r.type === 'badge' && r.badgeId && !stats.badges.includes(r.badgeId))
    .map((r) => r.badgeId!);

  // 6. Build stats update
  const statsUpdate: Record<string, any> = {
    xp: newXp,
    level: levelInfo.level,
    levelTitle: levelInfo.title,
    xpToNextLevel: levelInfo.xpToNextLevel,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (newBadges.length > 0) {
    statsUpdate.badges = FieldValue.arrayUnion(...newBadges);
  }

  // Apply counter increments from metadata
  if (event.metadata.incrementTasksCompleted) {
    statsUpdate.tasksCompleted = FieldValue.increment(1);
  }
  if (event.metadata.incrementProjectsCompleted) {
    statsUpdate.projectsCompleted = FieldValue.increment(1);
  }
  if (event.metadata.incrementPerfectScores) {
    statsUpdate.perfectScores = FieldValue.increment(1);
  }
  if (event.metadata.consecutiveOnTime !== undefined) {
    statsUpdate.consecutiveOnTime = event.metadata.consecutiveOnTime;
  }
  if (event.metadata.consecutiveZeroRevisions !== undefined) {
    statsUpdate.consecutiveZeroRevisions = event.metadata.consecutiveZeroRevisions;
  }
  if (event.metadata.streakUpdate) {
    statsUpdate.currentStreak = event.metadata.streakUpdate.currentStreak;
    statsUpdate.longestStreak = event.metadata.streakUpdate.longestStreak;
    statsUpdate.lastActiveDate = event.metadata.streakUpdate.lastActiveDate;
  }

  // 7. Batch write
  const batch = db.batch();

  // Stats doc (source of truth)
  if (statsSnap.exists) {
    batch.update(statsRef, statsUpdate);
  } else {
    batch.set(statsRef, { ...DEFAULT_STATS, ...statsUpdate });
  }

  // Sync key fields to freelancers doc for leaderboard/profile reads
  const freelancerSync: Record<string, any> = {
    xp: newXp,
    level: levelInfo.level,
    levelTitle: levelInfo.title,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (newBadges.length > 0) {
    freelancerSync.badges = FieldValue.arrayUnion(...newBadges);
  }
  batch.update(freelancerRef, freelancerSync);

  await batch.commit();

  // 8. Write notifications (outside batch - non-critical)
  const freelancerSnap = await freelancerRef.get();
  const freelancerName = freelancerSnap.data()?.name ?? 'Freelancer';

  for (const reward of rewards) {
    if (reward.type === 'xp' && reward.xp && reward.xp > 0) {
      await writeNotification(event.freelancerId, {
        type: 'xp_earned',
        title: `+${reward.xp} XP`,
        body: reward.description,
        metadata: { xp: reward.xp },
      });
    }
    if (reward.type === 'badge' && reward.badgeId && newBadges.includes(reward.badgeId)) {
      const badge = BADGE_REGISTRY[reward.badgeId];
      await writeNotification(event.freelancerId, {
        type: 'badge_earned',
        title: `Badge Earned: ${badge?.name ?? reward.badgeId}`,
        body: badge?.description ?? reward.description,
        metadata: { badgeId: reward.badgeId },
      });
      await writePublicActivity(
        event.freelancerId,
        freelancerName,
        'badge_earned',
        `Earned "${badge?.name ?? reward.badgeId}"`,
        badge?.description ?? '',
      );
    }
    if (reward.type === 'level_up' && reward.newLevel) {
      await writeNotification(event.freelancerId, {
        type: 'level_up',
        title: `Level Up! Level ${reward.newLevel}`,
        body: `You are now a ${reward.newTitle}`,
        metadata: { level: reward.newLevel, title: reward.newTitle },
      });
      await writePublicActivity(
        event.freelancerId,
        freelancerName,
        'level_up',
        `Reached Level ${reward.newLevel}`,
        `Now a ${reward.newTitle}`,
      );
    }
  }

  return rewards;
}
```

- [ ] **Step 4: Commit**

```bash
git add functions/src/utils/ functions/src/gamification/engine.ts
git commit -m "feat: add gamification engine core with notifications"
```

---

## Task 4: Rule Functions

**Files:**
- Create: `functions/src/gamification/rules/project-rules.ts`
- Create: `functions/src/gamification/rules/streak-rules.ts`
- Create: `functions/src/gamification/rules/milestone-rules.ts`

- [ ] **Step 1: Create project rules**

```typescript
// functions/src/gamification/rules/project-rules.ts
import type { GamificationEvent, FreelancerStats, Reward } from '../types';

export function getProjectRules(event: GamificationEvent, stats: FreelancerStats): Reward[] {
  const rewards: Reward[] = [];

  if (event.type === 'task_approved') {
    // Base task XP
    rewards.push({ type: 'xp', xp: 25, description: 'Task approved' });

    // First task badge
    if (stats.tasksCompleted === 0) {
      rewards.push({ type: 'badge', badgeId: 'first-task', description: 'Completed first task' });
    }

    // Task count badges
    const newCount = stats.tasksCompleted + 1;
    if (newCount === 10) rewards.push({ type: 'badge', badgeId: 'task-10', description: 'Completed 10 tasks' });
    if (newCount === 50) rewards.push({ type: 'badge', badgeId: 'task-50', description: 'Completed 50 tasks' });
    if (newCount === 100) rewards.push({ type: 'badge', badgeId: 'task-100', description: 'Completed 100 tasks' });

    // QA perfect score
    if (event.metadata.qaScore === 100) {
      rewards.push({ type: 'xp', xp: 30, description: 'QA perfect score' });
      rewards.push({ type: 'badge', badgeId: 'qa-perfect', description: 'QA perfect score' });
    }

    // On-time delivery
    if (event.metadata.isOnTime) {
      rewards.push({ type: 'xp', xp: 20, description: 'On-time delivery' });
      const newOnTime = stats.consecutiveOnTime + 1;
      event.metadata.consecutiveOnTime = newOnTime;
      if (newOnTime === 10) {
        rewards.push({ type: 'badge', badgeId: 'on-time-10', description: '10 consecutive on-time deliveries' });
      }
    } else {
      event.metadata.consecutiveOnTime = 0;
    }

    // Zero revisions
    if (event.metadata.hasRevisions === false) {
      const newZeroRev = stats.consecutiveZeroRevisions + 1;
      event.metadata.consecutiveZeroRevisions = newZeroRev;
      if (newZeroRev === 5) {
        rewards.push({ type: 'badge', badgeId: 'zero-revisions-5', description: '5 consecutive flawless tasks' });
      }
    } else {
      event.metadata.consecutiveZeroRevisions = 0;
    }

    event.metadata.incrementTasksCompleted = true;
  }

  if (event.type === 'project_completed') {
    rewards.push({ type: 'xp', xp: 100, description: 'Project completed' });
    event.metadata.incrementProjectsCompleted = true;
  }

  if (event.type === 'assessment_completed') {
    const score = event.metadata.finalScore ?? 0;
    const xp = 50 + Math.floor(score / 5);
    rewards.push({ type: 'xp', xp, description: `Assessment completed (score: ${score})` });
    rewards.push({ type: 'badge', badgeId: 'onboarding-complete', description: 'Assessment complete' });
  }

  return rewards;
}
```

- [ ] **Step 2: Create streak rules**

```typescript
// functions/src/gamification/rules/streak-rules.ts
import type { GamificationEvent, FreelancerStats, Reward } from '../types';

function getToday(): string {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

export function getStreakRules(event: GamificationEvent, stats: FreelancerStats): Reward[] {
  if (event.type !== 'presence_update') return [];

  const today = getToday();

  // Guard: already processed today
  if (stats.lastActiveDate === today) return [];

  const rewards: Reward[] = [];
  let currentStreak = stats.currentStreak;
  let longestStreak = stats.longestStreak;

  if (stats.lastActiveDate === getYesterday()) {
    // Consecutive day
    currentStreak += 1;
  } else {
    // Gap - reset
    currentStreak = 1;
  }

  if (currentStreak > longestStreak) {
    longestStreak = currentStreak;
  }

  // Streak badges
  if (currentStreak === 7) {
    rewards.push({ type: 'xp', xp: 100, description: '7-day streak bonus' });
    rewards.push({ type: 'badge', badgeId: 'streak-7', description: '7-day streak' });
    rewards.push({ type: 'streak', streakDays: 7, description: '7-day streak' });
  }
  if (currentStreak === 30) {
    rewards.push({ type: 'xp', xp: 500, description: '30-day streak bonus' });
    rewards.push({ type: 'badge', badgeId: 'streak-30', description: '30-day streak' });
    rewards.push({ type: 'streak', streakDays: 30, description: '30-day streak' });
  }
  if (currentStreak === 100) {
    rewards.push({ type: 'xp', xp: 2000, description: '100-day streak bonus' });
    rewards.push({ type: 'badge', badgeId: 'streak-100', description: '100-day streak' });
    rewards.push({ type: 'streak', streakDays: 100, description: '100-day streak' });
  }

  // Pass streak update to engine via metadata
  event.metadata.streakUpdate = { currentStreak, longestStreak, lastActiveDate: today };

  return rewards;
}
```

- [ ] **Step 3: Create milestone rules**

```typescript
// functions/src/gamification/rules/milestone-rules.ts
import type { GamificationEvent, FreelancerStats, Reward } from '../types';
import { computeLevel } from '../levels';

export function getMilestoneRules(event: GamificationEvent, stats: FreelancerStats): Reward[] {
  const rewards: Reward[] = [];

  // Level milestones (check after XP is added by other rules)
  // These are checked in the engine after computing new XP, but we pre-check here
  const xpGain = event.metadata._estimatedXpGain ?? 0;
  const projectedXp = stats.xp + xpGain;
  const projectedLevel = computeLevel(projectedXp).level;

  if (projectedLevel >= 5 && stats.level < 5) {
    rewards.push({ type: 'badge', badgeId: 'level-5', description: 'Reached Level 5 - Expert' });
  }
  if (projectedLevel >= 8 && stats.level < 8) {
    rewards.push({ type: 'badge', badgeId: 'level-8', description: 'Reached Level 8 - Legend' });
  }

  // Earnings milestones
  if (event.metadata.earningsAdded) {
    const newTotal = stats.totalEarned + event.metadata.earningsAdded;
    if (newTotal >= 10000 && stats.totalEarned < 10000) {
      rewards.push({ type: 'badge', badgeId: 'earned-10k', description: 'Earned $10,000 cumulative' });
    }
    if (newTotal >= 50000 && stats.totalEarned < 50000) {
      rewards.push({ type: 'badge', badgeId: 'earned-50k', description: 'Earned $50,000 cumulative' });
    }
  }

  return rewards;
}
```

- [ ] **Step 4: Verify compilation**

```bash
cd functions && npx tsc --noEmit && cd ..
```

- [ ] **Step 5: Commit**

```bash
git add functions/src/gamification/rules/
git commit -m "feat: add project, streak, and milestone rule functions"
```

---

## Task 5: Trigger Functions + Index

**Files:**
- Create: `functions/src/triggers/on-project-completed.ts`
- Create: `functions/src/triggers/on-task-approved.ts`
- Create: `functions/src/triggers/on-assessment-completed.ts`
- Create: `functions/src/triggers/on-presence-update.ts`
- Create: `functions/src/index.ts`

- [ ] **Step 1: Create on-project-completed trigger**

```typescript
// functions/src/triggers/on-project-completed.ts
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { processEvent } from '../gamification/engine';
import { db } from '../utils/firestore';
import { FieldValue } from 'firebase-admin/firestore';

export const onProjectCompleted = onDocumentUpdated(
  'projects/{projectId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    // Only trigger on status transition to 'completed'
    if (before.status === 'completed' || after.status !== 'completed') return;

    const freelancerId = after.assignedFreelancerId;
    if (!freelancerId) return;

    await processEvent({
      type: 'project_completed',
      freelancerId,
      metadata: { projectId: event.params.projectId },
    });

    // Write review prompt for client
    if (after.clientId) {
      await db
        .collection('reviewPrompts')
        .doc(after.clientId)
        .collection('items')
        .doc(event.params.projectId)
        .set({
          projectId: event.params.projectId,
          projectTitle: after.name ?? 'Untitled Project',
          freelancerId,
          freelancerName: '', // Will be filled by client-side read
          status: 'pending',
          createdAt: FieldValue.serverTimestamp(),
        });
    }
  }
);
```

- [ ] **Step 2: Create on-task-approved trigger**

```typescript
// functions/src/triggers/on-task-approved.ts
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { processEvent } from '../gamification/engine';

export const onTaskApproved = onDocumentUpdated(
  'projects/{projectId}/microtasks/{taskId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    // Only trigger on status transition to 'approved'
    if (before.status === 'approved' || after.status !== 'approved') return;

    const freelancerId = after.assignedFreelancerId;
    if (!freelancerId) return;

    // Determine on-time and revision status
    const isOnTime = after.estimatedDeliveryDate
      ? (after.completedAt?.toDate?.() ?? new Date()) <= after.estimatedDeliveryDate.toDate()
      : false;

    await processEvent({
      type: 'task_approved',
      freelancerId,
      metadata: {
        taskId: event.params.taskId,
        projectId: event.params.projectId,
        qaScore: after.qaScore ?? null,
        isOnTime,
        hasRevisions: (after.revisionCount ?? 0) > 0,
      },
    });
  }
);
```

- [ ] **Step 3: Create on-assessment-completed trigger**

```typescript
// functions/src/triggers/on-assessment-completed.ts
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { processEvent } from '../gamification/engine';

export const onAssessmentCompleted = onDocumentUpdated(
  'freelancers/{freelancerId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    // Only trigger when assessmentResultId is set for the first time
    if (before.assessmentResultId || !after.assessmentResultId) return;

    // Read the assessment to get the score
    const assessmentSnap = await event.data?.after.ref.firestore
      .collection('assessments')
      .doc(after.assessmentResultId)
      .get();

    const finalScore = assessmentSnap?.data()?.finalScore ?? 50;

    await processEvent({
      type: 'assessment_completed',
      freelancerId: event.params.freelancerId,
      metadata: { finalScore },
    });
  }
);
```

- [ ] **Step 4: Create on-presence-update trigger**

```typescript
// functions/src/triggers/on-presence-update.ts
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { processEvent } from '../gamification/engine';
import { db } from '../utils/firestore';

export const onPresenceUpdate = onDocumentUpdated(
  'freelancerPresence/{freelancerId}',
  async (event) => {
    const after = event.data?.after.data();
    if (!after || after.status !== 'active') return;

    const freelancerId = event.params.freelancerId;

    // Early guard: check if already processed today
    const today = new Date().toISOString().split('T')[0];
    const statsSnap = await db.collection('freelancerStats').doc(freelancerId).get();
    if (statsSnap.exists && statsSnap.data()?.lastActiveDate === today) return;

    await processEvent({
      type: 'presence_update',
      freelancerId,
      metadata: {},
    });
  }
);
```

- [ ] **Step 5: Create index.ts that exports all triggers**

```typescript
// functions/src/index.ts
export { onProjectCompleted } from './triggers/on-project-completed';
export { onTaskApproved } from './triggers/on-task-approved';
export { onAssessmentCompleted } from './triggers/on-assessment-completed';
export { onPresenceUpdate } from './triggers/on-presence-update';
// Review and community triggers will be added in Plans 2 and 3
```

- [ ] **Step 6: Verify full build**

```bash
cd functions && npx tsc && cd ..
```

- [ ] **Step 7: Commit**

```bash
git add functions/src/triggers/ functions/src/index.ts
git commit -m "feat: add Firestore trigger functions for gamification events"
```

---

## Task 6: Legacy Code Decommission

**Files:**
- Modify: `src/services/firestore.ts`
- Modify: `src/types/badge.ts`
- Modify: `src/types/freelancer.ts`

- [ ] **Step 1: Remove awardXp and awardBadge from firestore.ts**

Remove the `awardXp` function (lines 234-244) and `awardBadge` function (lines 246-256) entirely.

- [ ] **Step 2: Refactor storeAssessmentResult to remove XP/badge writes**

In `storeAssessmentResult`, remove these lines from the `batch.update(freelancerRef, ...)` call:
```
badges: arrayUnion('onboarding-complete'),
xp: increment(50 + Math.round(assessment.finalScore / 5)),
```

Keep the rest of the function intact (assessment storage, `assessmentResultId` link). The `onAssessmentCompleted` Cloud Function now handles XP and badge awards when it detects `assessmentResultId` being set.

- [ ] **Step 3: Replace badge registry in src/types/badge.ts**

Replace the entire file with the expanded ~20 badge registry that includes `category`, `iconName`, and `rarity` fields. Import `BadgeRarity` and `BadgeCategory` types. Keep the same export pattern (`BADGES` record) for backward compatibility with `FreelancerProfile`.

```typescript
// src/types/badge.ts
export type BadgeRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type BadgeCategory = 'onboarding' | 'projects' | 'quality' | 'community' | 'streaks' | 'milestones';

export interface Badge {
  id: string;
  name: string;
  description: string;
  category: BadgeCategory;
  iconName: string;
  rarity: BadgeRarity;
}

export const BADGES: Record<string, Badge> = {
  'onboarding-complete': { id: 'onboarding-complete', name: 'Assessment Complete', description: 'Complete the skill assessment', category: 'onboarding', iconName: 'GraduationCap', rarity: 'common' },
  'profile-complete': { id: 'profile-complete', name: 'Profile Complete', description: 'Fill out all profile fields', category: 'onboarding', iconName: 'UserCheck', rarity: 'common' },
  'first-connection': { id: 'first-connection', name: 'First Connection', description: 'Connect your first external tool', category: 'onboarding', iconName: 'Link', rarity: 'common' },
  'first-task': { id: 'first-task', name: 'First Task', description: 'Complete your first task', category: 'projects', iconName: 'CheckCircle', rarity: 'common' },
  'task-10': { id: 'task-10', name: 'Task Veteran', description: 'Complete 10 tasks', category: 'projects', iconName: 'ListChecks', rarity: 'uncommon' },
  'task-50': { id: 'task-50', name: 'Task Master', description: 'Complete 50 tasks', category: 'projects', iconName: 'Layers', rarity: 'rare' },
  'task-100': { id: 'task-100', name: 'Century Club', description: 'Complete 100 tasks', category: 'projects', iconName: 'Crown', rarity: 'epic' },
  'first-five-star': { id: 'first-five-star', name: 'Five Stars', description: 'Receive your first 5-star review', category: 'projects', iconName: 'Star', rarity: 'uncommon' },
  'qa-perfect': { id: 'qa-perfect', name: 'QA Perfect', description: 'Score 100/100 on a QA check', category: 'quality', iconName: 'ShieldCheck', rarity: 'uncommon' },
  'zero-revisions-5': { id: 'zero-revisions-5', name: 'Flawless Five', description: '5 consecutive tasks with zero revisions', category: 'quality', iconName: 'Sparkles', rarity: 'rare' },
  'on-time-10': { id: 'on-time-10', name: 'On-Time Champion', description: '10 consecutive on-time deliveries', category: 'quality', iconName: 'Clock', rarity: 'rare' },
  'first-post': { id: 'first-post', name: 'First Post', description: 'Create your first community post', category: 'community', iconName: 'MessageSquare', rarity: 'common' },
  'helpful-10': { id: 'helpful-10', name: 'Helpful', description: 'Receive 10 upvotes', category: 'community', iconName: 'ThumbsUp', rarity: 'uncommon' },
  'mentor-50': { id: 'mentor-50', name: 'Mentor', description: 'Write 50 community replies', category: 'community', iconName: 'Heart', rarity: 'rare' },
  'streak-7': { id: 'streak-7', name: 'Week Warrior', description: '7-day activity streak', category: 'streaks', iconName: 'Flame', rarity: 'common' },
  'streak-30': { id: 'streak-30', name: 'Monthly Grind', description: '30-day activity streak', category: 'streaks', iconName: 'Flame', rarity: 'uncommon' },
  'streak-100': { id: 'streak-100', name: 'Unstoppable', description: '100-day activity streak', category: 'streaks', iconName: 'Flame', rarity: 'epic' },
  'level-5': { id: 'level-5', name: 'Expert Status', description: 'Reach Level 5', category: 'milestones', iconName: 'Award', rarity: 'rare' },
  'level-8': { id: 'level-8', name: 'Legendary', description: 'Reach Level 8', category: 'milestones', iconName: 'Trophy', rarity: 'legendary' },
  'earned-10k': { id: 'earned-10k', name: '$10K Club', description: 'Earn $10,000 cumulative', category: 'milestones', iconName: 'DollarSign', rarity: 'rare' },
  'earned-50k': { id: 'earned-50k', name: '$50K Club', description: 'Earn $50,000 cumulative', category: 'milestones', iconName: 'Banknote', rarity: 'epic' },
};
```

- [ ] **Step 4: Add level/levelTitle to Freelancer type**

In `src/types/freelancer.ts`, add to the `Freelancer` interface:
```typescript
level?: number;
levelTitle?: string;
```

- [ ] **Step 5: Verify Next.js build**

```bash
npx next build --no-lint 2>&1 | tail -10
```

- [ ] **Step 6: Commit**

```bash
git add src/services/firestore.ts src/types/badge.ts src/types/freelancer.ts
git commit -m "feat: decommission legacy XP/badge functions, expand badge registry"
```

---

## Task 7: Client-Side Types + Hooks

**Files:**
- Create: `src/types/gamification.ts`
- Create: `src/hooks/use-freelancer-stats.ts`
- Create: `src/hooks/use-notifications.ts`

- [ ] **Step 1: Create client-side gamification types**

```typescript
// src/types/gamification.ts
export interface FreelancerStats {
  xp: number;
  level: number;
  levelTitle: string;
  xpToNextLevel: number;
  badges: string[];
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string;
  tasksCompleted: number;
  projectsCompleted: number;
  reviewAverage: number;
  reviewCount: number;
}

export interface GamificationNotification {
  id: string;
  type: 'xp_earned' | 'badge_earned' | 'level_up' | 'streak' | 'review_received';
  title: string;
  body: string;
  metadata: Record<string, any>;
  read: boolean;
  createdAt: any; // Firestore Timestamp
}

export interface PublicActivity {
  id: string;
  freelancerId: string;
  freelancerName: string;
  type: 'level_up' | 'badge_earned' | 'streak_milestone';
  title: string;
  description: string;
  createdAt: any;
}
```

- [ ] **Step 2: Create useFreelancerStats hook**

```typescript
// src/hooks/use-freelancer-stats.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { FreelancerStats } from '@/types/gamification';

export function useFreelancerStats(freelancerId: string | undefined) {
  return useQuery({
    queryKey: ['freelancerStats', freelancerId],
    queryFn: async (): Promise<FreelancerStats | null> => {
      if (!freelancerId) return null;
      const snap = await getDoc(doc(db, 'freelancerStats', freelancerId));
      if (!snap.exists()) return null;
      return snap.data() as FreelancerStats;
    },
    enabled: !!freelancerId,
    staleTime: 30_000,
  });
}
```

- [ ] **Step 3: Create useNotifications hook**

```typescript
// src/hooks/use-notifications.ts
'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { GamificationNotification } from '@/types/gamification';

export function useNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<GamificationNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, 'notifications', userId, 'items'),
      orderBy('createdAt', 'desc'),
      limit(20),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: GamificationNotification[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as GamificationNotification);
      });
      setNotifications(items);
      setUnreadCount(items.filter((n) => !n.read).length);
    });

    return () => unsubscribe();
  }, [userId]);

  const markAsRead = async (notificationId: string) => {
    if (!userId) return;
    await updateDoc(doc(db, 'notifications', userId, 'items', notificationId), { read: true });
  };

  const markAllAsRead = async () => {
    if (!userId || notifications.length === 0) return;
    const batch = writeBatch(db);
    notifications
      .filter((n) => !n.read)
      .forEach((n) => {
        batch.update(doc(db, 'notifications', userId, 'items', n.id), { read: true });
      });
    await batch.commit();
  };

  return { notifications, unreadCount, markAsRead, markAllAsRead };
}
```

- [ ] **Step 4: Commit**

```bash
git add src/types/gamification.ts src/hooks/use-freelancer-stats.ts src/hooks/use-notifications.ts
git commit -m "feat: add client-side gamification types and hooks"
```

---

## Task 8: Rarity CSS Tokens

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add rarity custom properties to globals.css**

Add after the existing custom properties in the `:root` block:

```css
/* Badge rarity colors */
--rarity-common: hsl(220 10% 60%);
--rarity-uncommon: hsl(152 60% 45%);
--rarity-rare: hsl(197 100% 50%);
--rarity-epic: hsl(270 60% 55%);
--rarity-legendary: hsl(40 95% 55%);
```

- [ ] **Step 2: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add badge rarity CSS custom properties"
```

---

## Task 9: XP Progress Card Component

**Files:**
- Create: `src/components/gamification/xp-progress-card.tsx`

- [ ] **Step 1: Create the XP progress card**

```typescript
// src/components/gamification/xp-progress-card.tsx
'use client';

import { Flame, ChevronRight } from 'lucide-react';
import { useFreelancerStats } from '@/hooks/use-freelancer-stats';
import { BADGES } from '@/types/badge';

interface XpProgressCardProps {
  freelancerId: string;
}

export function XpProgressCard({ freelancerId }: XpProgressCardProps) {
  const { data: stats, isLoading } = useFreelancerStats(freelancerId);

  if (isLoading || !stats) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 animate-pulse">
        <div className="h-4 w-24 bg-muted rounded mb-2" />
        <div className="h-2 w-full bg-muted rounded" />
      </div>
    );
  }

  const xpForCurrentLevel = stats.xp;
  const xpNeeded = stats.xpToNextLevel + stats.xp; // Approximate total for next level
  const progress = xpNeeded > 0 ? Math.min((xpForCurrentLevel / xpNeeded) * 100, 100) : 100;

  const recentBadges = stats.badges.slice(-3).reverse();

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      {/* Level */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            Level {stats.level}
          </span>
          <h3 className="text-sm font-bold">{stats.levelTitle}</h3>
        </div>
        {stats.currentStreak > 0 && (
          <div className="flex items-center gap-1 text-sm">
            <Flame className="h-4 w-4 text-orange-500" />
            <span className="font-semibold">{stats.currentStreak}d</span>
          </div>
        )}
      </div>

      {/* XP Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>{stats.xp.toLocaleString()} XP</span>
          <span>{stats.xpToNextLevel > 0 ? `${stats.xpToNextLevel.toLocaleString()} to next` : 'Max level'}</span>
        </div>
        <div className="h-2 rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Recent Badges */}
      {recentBadges.length > 0 && (
        <div className="flex items-center gap-1.5">
          {recentBadges.map((badgeId) => {
            const badge = BADGES[badgeId];
            if (!badge) return null;
            return (
              <div
                key={badgeId}
                className="flex h-6 w-6 items-center justify-center rounded-full border text-xs"
                style={{
                  borderColor: `var(--rarity-${badge.rarity})`,
                  color: `var(--rarity-${badge.rarity})`,
                }}
                title={badge.name}
              >
                {badge.name.charAt(0)}
              </div>
            );
          })}
          {stats.badges.length > 3 && (
            <span className="text-xs text-muted-foreground">
              +{stats.badges.length - 3} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/gamification/xp-progress-card.tsx
git commit -m "feat: add XP progress card component"
```

---

## Task 10: Badge Grid Component

**Files:**
- Create: `src/components/gamification/badge-grid.tsx`

- [ ] **Step 1: Create the badge grid**

```typescript
// src/components/gamification/badge-grid.tsx
'use client';

import { BADGES, type Badge, type BadgeCategory } from '@/types/badge';
import { Lock } from 'lucide-react';

interface BadgeGridProps {
  earnedBadges: string[];
  compact?: boolean; // Show only earned badges without locked
  filterCategory?: BadgeCategory;
}

const allBadges = Object.values(BADGES);

export function BadgeGrid({ earnedBadges, compact = false, filterCategory }: BadgeGridProps) {
  const badges = filterCategory
    ? allBadges.filter((b) => b.category === filterCategory)
    : allBadges;

  const displayed = compact ? badges.filter((b) => earnedBadges.includes(b.id)) : badges;

  if (displayed.length === 0) {
    return <p className="text-sm text-muted-foreground">No badges yet</p>;
  }

  return (
    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
      {displayed.map((badge) => {
        const isEarned = earnedBadges.includes(badge.id);
        return (
          <div
            key={badge.id}
            className="group relative flex flex-col items-center gap-1"
            title={isEarned ? `${badge.name}: ${badge.description}` : `Locked: ${badge.description}`}
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold transition-transform group-hover:scale-110 ${
                isEarned
                  ? badge.rarity === 'legendary'
                    ? 'animate-pulse'
                    : ''
                  : 'opacity-40 grayscale'
              }`}
              style={{
                borderColor: isEarned ? `var(--rarity-${badge.rarity})` : undefined,
                color: isEarned ? `var(--rarity-${badge.rarity})` : undefined,
              }}
            >
              {isEarned ? (
                badge.name.charAt(0)
              ) : (
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
            <span className={`text-[10px] text-center leading-tight ${isEarned ? '' : 'text-muted-foreground'}`}>
              {badge.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/gamification/badge-grid.tsx
git commit -m "feat: add badge grid component with earned/locked states"
```

---

## Task 11: Notification Bell Component

**Files:**
- Create: `src/components/notification-bell.tsx`

- [ ] **Step 1: Create the notification bell**

```typescript
// src/components/notification-bell.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell, Award, TrendingUp, Flame, Star, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useNotifications } from '@/hooks/use-notifications';
import { useToast } from '@/hooks/use-toast';
import { formatRelative } from '@/lib/timestamp';
import type { GamificationNotification } from '@/types/gamification';

const ICON_MAP: Record<string, typeof Bell> = {
  xp_earned: Zap,
  badge_earned: Award,
  level_up: TrendingUp,
  streak: Flame,
  review_received: Star,
};

export function NotificationBell() {
  const { user } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(user?.uid);
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const prevCountRef = useRef(0);

  // Achievement toast on new badge/level notifications
  useEffect(() => {
    if (unreadCount > prevCountRef.current && notifications.length > 0) {
      const newest = notifications[0];
      if (newest && !newest.read && (newest.type === 'badge_earned' || newest.type === 'level_up')) {
        toast({ title: newest.title, description: newest.body });
      }
    }
    prevCountRef.current = unreadCount;
  }, [unreadCount, notifications, toast]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  if (!user) return null;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted transition-colors"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">No notifications</p>
            ) : (
              notifications.map((n) => {
                const Icon = ICON_MAP[n.type] ?? Bell;
                return (
                  <button
                    key={n.id}
                    onClick={() => { markAsRead(n.id); }}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors ${
                      !n.read ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{n.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{n.body}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/notification-bell.tsx
git commit -m "feat: add notification bell with real-time updates and achievement toasts"
```

---

## Task 12: Backfill Script

**Files:**
- Create: `functions/src/scripts/backfill-stats.ts`

- [ ] **Step 1: Create the migration script**

```typescript
// functions/src/scripts/backfill-stats.ts
/**
 * One-time migration: copies existing XP/badges from freelancers/{id}
 * to freelancerStats/{id} and computes levels.
 *
 * Run: npx ts-node functions/src/scripts/backfill-stats.ts
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize with default credentials (requires GOOGLE_APPLICATION_CREDENTIALS env var)
initializeApp();
const db = getFirestore();

interface LevelInfo { level: number; title: string; xpToNextLevel: number; }

const LEVELS = [
  { level: 1, title: 'Newcomer', cumulative: 0 },
  { level: 2, title: 'Apprentice', cumulative: 200 },
  { level: 3, title: 'Journeyman', cumulative: 700 },
  { level: 4, title: 'Specialist', cumulative: 1700 },
  { level: 5, title: 'Expert', cumulative: 3700 },
  { level: 6, title: 'Master', cumulative: 7700 },
  { level: 7, title: 'Grandmaster', cumulative: 15700 },
  { level: 8, title: 'Legend', cumulative: 31700 },
];

function computeLevel(xp: number): LevelInfo {
  let current = LEVELS[0];
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].cumulative) { current = LEVELS[i]; break; }
  }
  const next = LEVELS.find((t) => t.level === current.level + 1);
  return { level: current.level, title: current.title, xpToNextLevel: next ? next.cumulative - xp : 0 };
}

async function backfill() {
  const freelancers = await db.collection('freelancers').get();
  let migrated = 0;

  for (const doc of freelancers.docs) {
    const data = doc.data();
    const xp = data.xp ?? 0;
    const badges = data.badges ?? [];

    if (xp === 0 && badges.length === 0) continue;

    const levelInfo = computeLevel(xp);
    const statsRef = db.collection('freelancerStats').doc(doc.id);
    const existing = await statsRef.get();

    if (existing.exists) {
      console.log(`Skipping ${doc.id} - stats already exist`);
      continue;
    }

    await statsRef.set({
      xp,
      level: levelInfo.level,
      levelTitle: levelInfo.title,
      xpToNextLevel: levelInfo.xpToNextLevel,
      badges,
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: '',
      tasksCompleted: 0,
      projectsCompleted: 0,
      perfectScores: 0,
      consecutiveOnTime: 0,
      consecutiveZeroRevisions: 0,
      totalEarned: 0,
      reviewAverage: data.rating ?? 0,
      reviewCount: 0,
      categoryAverages: { quality: 0, communication: 0, timeliness: 0, expertise: 0 },
      dailyCommunityXp: 0,
      dailyCommunityXpDate: '',
      updatedAt: null,
    });

    // Sync level to freelancer doc
    await db.collection('freelancers').doc(doc.id).update({
      level: levelInfo.level,
      levelTitle: levelInfo.title,
    });

    migrated++;
    console.log(`Migrated ${doc.id}: ${xp} XP, Level ${levelInfo.level}, ${badges.length} badges`);
  }

  console.log(`Done. Migrated ${migrated} freelancers.`);
}

backfill().catch(console.error);
```

- [ ] **Step 2: Commit**

```bash
git add functions/src/scripts/backfill-stats.ts
git commit -m "feat: add one-time freelancerStats backfill migration script"
```

---

## Task 13: Build Verification

- [ ] **Step 1: Verify Cloud Functions compile**

```bash
cd functions && npx tsc && cd ..
```

- [ ] **Step 2: Verify Next.js builds**

```bash
npx next build --no-lint 2>&1 | tail -10
```

- [ ] **Step 3: Fix any errors (if needed)**

- [ ] **Step 4: Final commit (if fixes needed)**

```bash
git add -A
git commit -m "fix: resolve build errors in gamification engine"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Firebase project setup | 4 config files |
| 2 | Types + Levels + Badges | 3 CF files |
| 3 | Engine core + Utils | 3 CF files |
| 4 | Rule functions | 3 CF files |
| 5 | Trigger functions + Index | 5 CF files |
| 6 | Legacy code decommission | 3 modified files |
| 7 | Client types + hooks | 3 client files |
| 8 | Rarity CSS tokens | 1 modified file |
| 9 | XP progress card | 1 component |
| 10 | Badge grid | 1 component |
| 11 | Notification bell | 1 component |
| 12 | Backfill script | 1 script |
| 13 | Build verification | N/A |

**Total: ~22 new files, 4 modified files, 13 tasks.**
**Next:** Plan 2 (Reputation System) and Plan 3 (Community Hub)
