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
