// functions/src/scripts/backfill-stats.ts
/**
 * One-time migration: copies existing XP/badges from freelancers/{id}
 * to freelancerStats/{id} and computes levels.
 *
 * Run: npx ts-node functions/src/scripts/backfill-stats.ts
 */
import { initializeApp } from 'firebase-admin/app';
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
