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
