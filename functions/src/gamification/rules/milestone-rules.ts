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
