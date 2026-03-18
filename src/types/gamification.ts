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
