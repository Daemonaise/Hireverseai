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
