// functions/src/gamification/rules/community-rules.ts
import type { GamificationEvent, FreelancerStats, Reward } from '../types';

export function getCommunityRules(event: GamificationEvent, stats: FreelancerStats): Reward[] {
  // Community rules are handled directly in the triggers with transaction-based caps
  // This function handles badge checks only
  const rewards: Reward[] = [];

  if (event.type === 'community_post') {
    // First post badge
    if (!stats.badges.includes('first-post')) {
      rewards.push({ type: 'badge', badgeId: 'first-post', description: 'First community post' });
    }
  }

  return rewards;
}
