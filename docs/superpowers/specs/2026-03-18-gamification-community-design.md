# Gamification, Reputation & Community Design Spec

**Goal:** Build a full-stack gamification engine (Cloud Functions + Firestore triggers), client review/reputation system, and public community hub with forums, leaderboard, showcase, and activity feed.

**Architecture:** Firebase Cloud Functions v2 (gen2) with Firestore triggers. Server-side rule pipeline processes platform events and writes rewards back to Firestore. Client reads via real-time `onSnapshot` listeners for notifications and achievement toasts.

**Approach:** C - Firestore triggers with Cloud Functions. Most decoupled, fully server-side, scales independently of the web app.

---

## 0. Migration & Setup Prerequisites

### 0.1 Firebase Setup

The project does not currently have `firebase.json` or `.firebaserc`. Before implementation:

1. Install `firebase-tools` globally: `npm install -g firebase-tools`
2. Run `firebase init` at the project root to create `firebase.json` and `.firebaserc` with the existing Firebase project ID
3. Select Functions + Firestore during init
4. The `functions/` directory will have its own `package.json` with `firebase-functions` (v2) and `firebase-admin` as dependencies

### 0.2 Legacy Code Decommission

The following existing functions in `src/services/firestore.ts` must be **removed or stubbed** before the CF engine goes live. They currently write XP and badges directly to `freelancers/{id}`, which will conflict with the Cloud Functions engine:

- `awardXp(freelancerId, amount)` (lines 234-244): Remove. XP writes become exclusive to Cloud Functions.
- `awardBadge(freelancerId, badgeId)` (lines 246-256): Remove. Also awards 50 XP on every call, which would double-count.
- `storeAssessmentResult()` (lines 259-288): Refactor to remove the `xp: increment(...)` and `badges: arrayUnion('onboarding-complete')` writes. The `onAssessmentCompleted` Cloud Function handles this instead. Keep the rest of `storeAssessmentResult` (assessment data storage).

### 0.3 Existing Data Backfill

Freelancers who earned XP and badges before the CF engine is live have data only on `freelancers/{id}`. A one-time migration script must:

1. Read all `freelancers` documents that have `xp > 0` or `badges.length > 0`
2. Create corresponding `freelancerStats/{freelancerId}` documents with the existing XP, badges, and `level` computed from `computeLevel(xp)`
3. Run as a standalone script (`functions/src/scripts/backfill-stats.ts`), not a Cloud Function

### 0.4 Badge Registry Replacement

The existing badge registry in `src/types/badge.ts` (5 badges: `onboarding-complete`, `first-task-success`, `top-scorer-react`, `helpful-mentor`, `community-contributor`) is replaced wholesale by the new ~20 badge registry. Only `onboarding-complete` carries over with the same ID. The other 4 IDs are retired:
- `first-task-success` -> replaced by `first-task`
- `top-scorer-react` -> removed (no equivalent)
- `helpful-mentor` -> replaced by `mentor-50`
- `community-contributor` -> replaced by `first-post`

### 0.5 Leaderboard Query Rewrite

The existing `getTopFreelancers()` in `src/services/firestore.ts` returns dummy data. It must be rewritten (or a new `queryLeaderboard()` function created) as a real paginated Firestore query against the `freelancers` collection, ordered by `xp DESC`, with optional skill and level filters.

---

## 1. Gamification Engine (Cloud Functions)

### 1.1 Infrastructure

New `functions/` directory at project root with its own `package.json`, `tsconfig.json`, and Firebase Admin SDK. Gen2 Cloud Functions running on Node.js 20.

### 1.2 Project Structure

```
functions/
  package.json
  tsconfig.json
  src/
    index.ts                        # Export all triggers
    gamification/
      engine.ts                     # processEvent(type, freelancerId, metadata)
      levels.ts                     # Level thresholds, computeLevel(xp)
      rules/
        project-rules.ts            # Task/project completion rewards
        review-rules.ts             # Review-based rewards
        community-rules.ts          # Forum post/reply/vote rewards
        streak-rules.ts             # Streak tracking + rewards
        milestone-rules.ts          # Earnings, task count milestones
      badges.ts                     # Full badge registry (~20 badges)
    triggers/
      on-project-completed.ts
      on-task-approved.ts
      on-review-created.ts
      on-assessment-completed.ts
      on-community-post.ts
      on-community-vote.ts
      on-presence-update.ts
    utils/
      firestore.ts                  # Admin SDK helpers
      notifications.ts              # writeNotification helper
```

### 1.3 Trigger Map

| Firestore Write | Trigger Type | Cloud Function | What It Does |
|----------------|-------------|----------------|-------------|
| `projects/{id}` status -> `completed` | `onDocumentUpdated` | `onProjectCompleted` | Awards project XP, checks milestone badges, writes review prompt for client |
| `projects/{id}/microtasks/{taskId}` status -> `approved` | `onDocumentUpdated` | `onTaskApproved` | Awards task XP (25), increments `tasksCompleted`, checks task count badges |
| `reviews/{id}` created | `onDocumentCreated` | `onReviewCreated` | Awards review XP, updates rolling average, checks first-five-star badge |
| `freelancers/{id}` assessment fields updated | `onDocumentUpdated` | `onAssessmentCompleted` | Awards assessment XP (50 + score/5), awards onboarding-complete badge |
| `communityPosts/{id}` created | `onDocumentCreated` | `onCommunityPost` | Awards post XP (5, capped 50/day) |
| `communityPosts/{id}/votes/{voteId}` created | `onDocumentCreated` | `onCommunityVote` | Awards upvote XP to post author (10, capped 100/day) |
| `freelancerPresence/{id}` updated with `status: 'active'` | `onDocumentUpdated` | `onPresenceUpdate` | Updates streak (increment if yesterday, reset if gap), checks streak badges |

### 1.4 Engine Core

`processEvent(eventType, freelancerId, metadata)` in `functions/src/gamification/engine.ts`:

1. Read `freelancerStats/{freelancerId}` (create if missing with defaults)
2. Run event through all matching rule functions: `(event, stats, metadata) => Reward[]`
3. Collect all rewards (XP grants, badge awards, level changes, streak updates)
4. Check for level-up: `computeLevel(newXp)` vs current level
5. Batch write to Firestore:
   - Update `freelancerStats/{freelancerId}` (XP, level, badges, streaks, counters) - source of truth
   - Update `freelancers/{freelancerId}` (sync `xp`, `level`, `levelTitle`, `badges`, `rating` for leaderboard queries and profile display)
   - Write notification(s) to `notifications/{freelancerId}/items/{id}` for each reward
6. Return reward summary

All operations must be **idempotent** - Cloud Functions can fire multiple times. Before awarding a badge, check if it's already in the array. Before incrementing XP, use a transaction or check for duplicate event processing via an `processedEvents` set on the stats doc.

### 1.5 Leveling System

| Level | Title | XP Required | Cumulative XP |
|-------|-------|-------------|---------------|
| 1 | Newcomer | 0 | 0 |
| 2 | Apprentice | 200 | 200 |
| 3 | Journeyman | 500 | 700 |
| 4 | Specialist | 1,000 | 1,700 |
| 5 | Expert | 2,000 | 3,700 |
| 6 | Master | 4,000 | 7,700 |
| 7 | Grandmaster | 8,000 | 15,700 |
| 8 | Legend | 16,000 | 31,700 |

`computeLevel(xp)` in `functions/src/gamification/levels.ts`: iterates thresholds, returns `{ level, title, xpToNextLevel }`.

Level-up triggers a notification with type `level_up`.

### 1.6 XP Award Table

| Event | XP | Notes |
|-------|-----|-------|
| Task approved | 25 | Per microtask |
| Project completed | 100 | Bonus on top of task XP |
| 5-star review received | 50 | Additional to base review XP |
| Any review received | 10 + (rating * 10) | 1-star = 20, 5-star = 60 |
| QA perfect score (100/100) | 30 | Triggered inside `onTaskApproved` when microtask has `qaScore === 100` |
| On-time delivery | 20 | Triggered inside `onTaskApproved` when `completedAt <= estimatedDeliveryDate` on the microtask doc |
| Assessment completed | 50 + floor(score / 5) | Existing logic, moved to CF |
| 7-day streak | 100 | One-time per streak |
| 30-day streak | 500 | One-time per streak |
| 100-day streak | 2,000 | One-time per streak |
| Community post | 5 | Capped at 50 XP/day |
| Community reply | 3 | Capped at 30 XP/day |
| Upvote received | 10 | Capped at 100 XP/day |

### 1.7 Streaks

Tracked via `onPresenceUpdate` trigger. The CF fires on every `freelancerPresence/{id}` write (presence heartbeats every 60s), so it must gate early:

**Guard logic (first thing in the function):**
1. Read `freelancerStats/{id}.lastActiveDate`
2. If `lastActiveDate === today (YYYY-MM-DD)`: return early (already processed today)
3. Only proceed if the date has changed

**Streak logic (runs only when date changed):**
- If `lastActiveDate === yesterday`: increment `currentStreak`, update `longestStreak` if higher, check streak badge thresholds
- If `lastActiveDate` is older than yesterday: reset `currentStreak` to 1, preserve `longestStreak`
- Update `lastActiveDate` to today (YYYY-MM-DD)

This means the CF fires ~1,440 times/day per active freelancer but does real work only once (the first heartbeat of each day). All subsequent calls hit the early return after a single Firestore read.

### 1.8 Badge Registry (~20 badges)

Each badge: `{ id, name, description, category, iconName, rarity, criteria }`.

**Onboarding:**
| Badge | Rarity | Criteria |
|-------|--------|----------|
| `onboarding-complete` | common | Complete the skill assessment |
| `profile-complete` | common | Fill out all profile fields |
| `first-connection` | common | Connect first external tool in hub |

**Projects:**
| Badge | Rarity | Criteria |
|-------|--------|----------|
| `first-task` | common | Complete your first task |
| `task-10` | uncommon | Complete 10 tasks |
| `task-50` | rare | Complete 50 tasks |
| `task-100` | epic | Complete 100 tasks |
| `first-five-star` | uncommon | Receive your first 5-star review |

**Quality:**
| Badge | Rarity | Criteria |
|-------|--------|----------|
| `qa-perfect` | uncommon | Score 100/100 on a QA check |
| `zero-revisions-5` | rare | 5 consecutive tasks with zero revision requests. Counter `consecutiveZeroRevisions` increments in `onTaskApproved` when task has no revision history; resets to 0 when a task has revisions. |
| `on-time-10` | rare | 10 consecutive on-time deliveries. Counter `consecutiveOnTime` increments in `onTaskApproved` when `completedAt <= estimatedDeliveryDate`; resets to 0 when late. |

**Community:**
| Badge | Rarity | Criteria |
|-------|--------|----------|
| `first-post` | common | Create your first community post |
| `helpful-10` | uncommon | Receive 10 upvotes on your posts/replies |
| `mentor-50` | rare | Write 50 community replies |

**Streaks:**
| Badge | Rarity | Criteria |
|-------|--------|----------|
| `streak-7` | common | 7-day activity streak |
| `streak-30` | uncommon | 30-day activity streak |
| `streak-100` | epic | 100-day activity streak |

**Milestones:**
| Badge | Rarity | Criteria |
|-------|--------|----------|
| `level-5` | rare | Reach Level 5 (Expert) |
| `level-8` | legendary | Reach Level 8 (Legend) |
| `earned-10k` | rare | Earn $10,000 cumulative |
| `earned-50k` | epic | Earn $50,000 cumulative |

Badge `iconName` maps to a Lucide icon string (e.g., `'Award'`, `'Star'`, `'Flame'`, `'Trophy'`).

Rarity determines visual treatment. Define as CSS custom properties in `globals.css` for consistency with the design system:

```css
--rarity-common: hsl(220 10% 60%);
--rarity-uncommon: hsl(152 60% 45%);
--rarity-rare: hsl(197 100% 50%);    /* matches primary */
--rarity-epic: hsl(270 60% 55%);
--rarity-legendary: hsl(40 95% 55%);
```

Tailwind usage: `text-[var(--rarity-common)]`, `border-[var(--rarity-common)]`, etc. Legendary adds `animate-pulse` for a subtle glow. All colors verified for contrast against both `bg-white` (light content) and `bg-chrome` (dark shell).

---

## 2. Reputation System

### 2.1 Reviews Collection

**`reviews/{id}`:**
```typescript
{
  id: string;
  projectId: string;
  freelancerId: string;
  clientId: string;
  clientName: string;
  projectTitle: string;
  rating: number;               // 1-5 overall
  categories: {
    quality: number;            // 1-5
    communication: number;      // 1-5
    timeliness: number;         // 1-5
    expertise: number;          // 1-5
  };
  comment: string;
  freelancerReply?: string;
  freelancerRepliedAt?: Timestamp;
  isVerified: boolean;          // true = linked to real completed project
  createdAt: Timestamp;
}
```

### 2.2 Review Prompt Flow

1. `onProjectCompleted` Cloud Function writes to `reviewPrompts/{clientId}/items/{projectId}`:
   ```typescript
   {
     projectId: string;
     projectTitle: string;
     freelancerId: string;
     freelancerName: string;
     createdAt: Timestamp;
     status: 'pending' | 'completed' | 'dismissed';
   }
   ```
2. Client dashboard component queries pending review prompts and shows a review card for each
3. Client submits: writes `reviews/{id}` and updates prompt status to `completed`
4. Client can dismiss: updates prompt status to `dismissed` (no review written)

### 2.3 Rating Aggregation

`onReviewCreated` Cloud Function computes rolling averages:

```
newAverage = ((oldAverage * oldCount) + newRating) / (oldCount + 1)
```

Updates `freelancerStats/{id}`:
- `reviewAverage`: overall rolling average
- `reviewCount`: total reviews
- `categoryAverages: { quality, communication, timeliness, expertise }`: per-category rolling averages

Also syncs `freelancers/{id}.rating` with the new `reviewAverage` for leaderboard sorting.

### 2.4 Freelancer Reply

Freelancers can reply once to any review. The reply is written directly to the `reviews/{id}` document:
- `freelancerReply: string`
- `freelancerRepliedAt: Timestamp`

No back-and-forth. One response only.

### 2.5 Review Display

**Freelancer profile page** (`/freelancer/[id]`):
- Overall rating (large stars) with review count
- Category breakdown: 4 horizontal bars (quality, communication, timeliness, expertise)
- Paginated review list: client name, project title, star rating, comment, optional freelancer reply
- Verified badge on reviews linked to completed projects

---

## 3. Community Hub

### 3.1 Data Model

**`communityPosts/{id}`:**
```typescript
{
  id: string;
  authorId: string;
  authorName: string;
  authorLevel: number;
  authorLevelTitle: string;
  category: 'general' | 'showcase' | 'help' | 'hiring' | 'feedback';
  title: string;
  body: string;
  tags: string[];
  upvotes: number;
  replyCount: number;
  isPinned: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**`communityPosts/{id}/replies/{replyId}`:**
```typescript
{
  id: string;
  authorId: string;
  authorName: string;
  authorLevel: number;
  body: string;
  upvotes: number;
  isAccepted: boolean;          // For "help" category, OP marks best answer
  createdAt: Timestamp;
}
```

**`communityPosts/{id}/votes/{voteId}`** (one doc per voter for idempotency):
```typescript
{
  userId: string;
  value: 1;                     // Upvote only, no downvotes
  createdAt: Timestamp;
}
```

### 3.2 Forum Categories

| Category | Purpose | Special Features |
|----------|---------|-----------------|
| General | Open discussion | None |
| Showcase | Share completed work, portfolio pieces | Image/link support |
| Help | Ask questions, get answers | Accepted answer pattern |
| Hiring | Clients post what they're looking for | Client-only posting |
| Feedback | Platform feedback and feature requests | None |

### 3.3 Community Page Revamp (`/community`)

Replace the current leaderboard-only page with a tabbed layout. Uses the existing dark-themed landing style for the page wrapper but light content area for readability.

**Tabs:**

1. **Leaderboard** (default tab):
   - Wire to real Firestore data (query `freelancers` collection ordered by `xp` desc)
   - Add filters: skill dropdown, level range, time period (all-time / this month / this week)
   - Pagination (20 per page)
   - Each row shows: rank, avatar placeholder, name, level badge, top skills, rating, XP
   - Click row -> freelancer profile

2. **Forums** tab:
   - Category filter pills at top (All, General, Showcase, Help, Hiring, Feedback)
   - Sort: Recent / Popular / Unanswered
   - Post list: title, author (with level badge), category pill, upvote count, reply count, time ago
   - Click post -> post detail view with reply thread
   - "New Post" button -> compose form (title, category select, body textarea, tags input)
   - Reply form at bottom of each post

3. **Showcase** tab:
   - Filtered view of showcase-category posts in a card grid layout
   - Each card: title, author, preview of body text, tags, upvotes
   - Click -> full post detail

4. **Activity** tab:
   - Public feed of recent achievements across the platform
   - Items: "Maria reached Level 5 (Expert)", "Alex earned the 'QA Perfect' badge", "Jordan hit a 30-day streak"
   - Reads from a denormalized `publicActivity` collection (written by Cloud Functions alongside notifications)
   - Shows freelancer name, achievement, and timestamp
   - Limited to last 50 items, paginated

### 3.4 Moderation

Simple flag system:
- Any authenticated user can flag a post or reply (one flag per user per item)
- Writes to `moderationQueue/{id}`: `{ itemType, itemId, reporterId, reason, createdAt }`
- 3+ unique flags auto-hides the content (`isHidden: true` on the post/reply)
- Admin reviews via Firestore console (no admin UI in this scope)
- Hidden posts show "[This post has been hidden for review]" placeholder

### 3.5 Community XP Caps

Tracked in `freelancerStats/{id}`:
- `dailyCommunityXp: number` (resets when `dailyCommunityXpDate` != today)
- `dailyCommunityXpDate: string` (YYYY-MM-DD)

Caps per day:
- Posts: 5 XP each, max 50 XP/day (10 posts)
- Replies: 3 XP each, max 30 XP/day (10 replies)
- Upvotes received: 10 XP each, max 100 XP/day

Cloud Function checks caps inside a **Firestore transaction** (`runTransaction`) on `freelancerStats/{id}`. The transaction reads `dailyCommunityXp` and `dailyCommunityXpDate`, resets if date changed, then conditionally increments. This prevents TOCTOU races from concurrent upvote triggers on popular posts.

---

## 4. Client-Side Integration

### 4.1 Data Model (Firestore)

**`freelancerStats/{freelancerId}`** (new collection):
```typescript
{
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
  updatedAt: Timestamp;
}
```

**`notifications/{userId}/items/{id}`** (new subcollection):
```typescript
{
  type: 'xp_earned' | 'badge_earned' | 'level_up' | 'streak' | 'review_received';
  title: string;
  body: string;
  metadata: Record<string, any>;
  read: boolean;
  createdAt: Timestamp;
}
```

**`publicActivity/{id}`** (new collection, denormalized feed):
```typescript
{
  freelancerId: string;
  freelancerName: string;
  type: 'level_up' | 'badge_earned' | 'streak_milestone';
  title: string;
  description: string;
  createdAt: Timestamp;
}
```

### 4.2 Notification Bell

Component: `src/components/notification-bell.tsx`

- Renders in the app shell header (both freelancer hub and client dashboard)
- Shows unread count badge (red dot with number)
- Dropdown panel on click: list of recent notifications with icon, title, body, time ago
- "Mark all as read" button
- Uses `onSnapshot` listener on `notifications/{userId}/items` for real-time updates
- Queries: `orderBy('createdAt', 'desc'), limit(20), where('read', '==', false)` for count

### 4.3 Achievement Toast

When a new notification appears with type `badge_earned` or `level_up`:
- Show a celebratory toast (via existing `useToast`)
- Toast includes badge icon (mapped from `iconName`), title, and XP earned
- Auto-dismiss after 5 seconds

Triggered by the `onSnapshot` listener detecting a new document.

### 4.4 Freelancer Dashboard XP Card

Component: `src/components/gamification/xp-progress-card.tsx`

Shows in the freelancer hub sidebar or dashboard:
- Level number + title (e.g., "Level 5 - Expert")
- XP progress bar to next level (e.g., "2,300 / 3,700 XP")
- Current streak with flame icon
- 3 most recent badges (click to see all)

Reads from `freelancerStats/{freelancerId}` via a React Query hook.

### 4.5 Badge Display Component

Component: `src/components/gamification/badge-grid.tsx`

Reusable grid showing earned + locked badges:
- Earned badges: full color with rarity border treatment
- Locked badges: grayscale with "?" overlay and criteria tooltip on hover
- Used in: freelancer profile, XP progress card (compact mode), community user cards

### 4.6 Client Review Form

Component: `src/components/reviews/review-form.tsx`

- Star rating (1-5, click to set)
- Category ratings: 4 rows (Quality, Communication, Timeliness, Expertise) each with 1-5 stars
- Comment textarea (required, min 20 chars)
- Submit button

Shows in client dashboard when `reviewPrompts/{clientId}/items` has pending entries.

### 4.7 Review Display

Component: `src/components/reviews/review-list.tsx`

- Paginated list of reviews for a freelancer
- Each review: client name, project title, overall stars, category mini-bars, comment, optional reply
- Used on freelancer profile page

Component: `src/components/reviews/review-summary.tsx`

- Overall rating (large number + stars)
- Review count
- Category breakdown bars (quality, communication, timeliness, expertise as horizontal progress bars)
- Used at top of review section on freelancer profile

### 4.8 Community Components

| Component | Path | Description |
|-----------|------|-------------|
| `CommunityPage` | `src/app/community/page.tsx` | Rewrite with tab layout |
| `LeaderboardTab` | `src/components/community/leaderboard-tab.tsx` | Real Firestore data, filters, pagination |
| `ForumsTab` | `src/components/community/forums-tab.tsx` | Post list with category/sort filters |
| `PostDetail` | `src/components/community/post-detail.tsx` | Single post with reply thread |
| `PostCompose` | `src/components/community/post-compose.tsx` | New post form |
| `ShowcaseTab` | `src/components/community/showcase-tab.tsx` | Gallery grid of showcase posts |
| `ActivityTab` | `src/components/community/activity-tab.tsx` | Public achievement feed |
| `CommunityUserCard` | `src/components/community/user-card.tsx` | Author card with level, badges |
| `UpvoteButton` | `src/components/community/upvote-button.tsx` | Upvote with count, idempotent |

---

## 5. Firestore Security Rules

Key rules for the new collections:

- `freelancerStats/{id}`: read by anyone, write only by Cloud Functions (admin SDK)
- `notifications/{userId}/items/{id}`: read/write only by the owner (`request.auth.uid == userId`), except `read` field which owner can update
- `reviews/{id}`: read by anyone, create by authenticated client (`request.auth.uid == resource.data.clientId`), update only `freelancerReply` + `freelancerRepliedAt` by the freelancer
- `communityPosts/{id}`: read by anyone, create by authenticated users, update only by author, delete by author. **Hiring category enforcement:** Firestore rule checks `request.resource.data.category != 'hiring' || exists(/databases/$(database)/documents/clients/$(request.auth.uid))` to restrict hiring posts to clients only.
- `communityPosts/{id}/votes/{id}`: create by authenticated users (one per user enforced by doc ID = userId)
- `communityPosts/{id}/replies/{id}`: read by anyone, create by authenticated users
- `reviewPrompts/{clientId}/items/{id}`: read/write only by the client
- `publicActivity/{id}`: read by anyone, write only by Cloud Functions
- `moderationQueue/{id}`: create by authenticated users, read only by admins

---

## 6. Deployment

### Firebase Config

Add to `firebase.json`:
```json
{
  "functions": {
    "source": "functions",
    "runtime": "nodejs20"
  }
}
```

### Environment

Cloud Functions need the Firebase project config. No additional API keys required since they use Firebase Admin SDK with automatic credentials.

### Deploy Command

```bash
cd functions && npm install && npm run build
firebase deploy --only functions
```

### Firestore Indexes

New composite indexes needed:
- `communityPosts`: `category` ASC + `createdAt` DESC
- `communityPosts`: `category` ASC + `upvotes` DESC
- `reviews`: `freelancerId` ASC + `createdAt` DESC
- `freelancers`: `xp` DESC (for leaderboard)
- `notifications/{userId}/items`: `read` ASC + `createdAt` DESC

---

## 7. What's NOT in Scope

- Admin moderation UI (use Firestore console for beta)
- Email/push notifications (in-app only)
- Seasonal leaderboard resets
- Badge trading or marketplace
- Custom badge creation
- Rich text editor for community posts (plain text + basic markdown)
- Image uploads for showcase posts (link-only for now)
- Referral system (defined in event types but no implementation)
- Mobile app considerations
