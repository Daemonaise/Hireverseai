// functions/src/gamification/rules/review-rules.ts
import type { GamificationEvent, FreelancerStats, Reward } from '../types';

export function getReviewRules(event: GamificationEvent, stats: FreelancerStats): Reward[] {
  if (event.type !== 'review_received') return [];

  const rewards: Reward[] = [];
  const rating = event.metadata.rating ?? 0;

  // Base review XP: 10 + (rating * 10)
  const xp = 10 + rating * 10;
  rewards.push({ type: 'xp', xp, description: `Review received (${rating} stars)` });

  // 5-star bonus
  if (rating === 5) {
    rewards.push({ type: 'xp', xp: 50, description: '5-star review bonus' });
    // First five-star badge
    if (!stats.badges.includes('first-five-star')) {
      rewards.push({ type: 'badge', badgeId: 'first-five-star', description: 'First 5-star review' });
    }
  }

  return rewards;
}
