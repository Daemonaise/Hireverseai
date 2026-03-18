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
