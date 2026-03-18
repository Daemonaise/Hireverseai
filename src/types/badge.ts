// src/types/badge.ts
export type BadgeRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type BadgeCategory = 'onboarding' | 'projects' | 'quality' | 'community' | 'streaks' | 'milestones';

export interface Badge {
  id: string;
  name: string;
  description: string;
  category: BadgeCategory;
  iconName: string;
  rarity: BadgeRarity;
}

export const BADGES: Record<string, Badge> = {
  'onboarding-complete': { id: 'onboarding-complete', name: 'Assessment Complete', description: 'Complete the skill assessment', category: 'onboarding', iconName: 'GraduationCap', rarity: 'common' },
  'profile-complete': { id: 'profile-complete', name: 'Profile Complete', description: 'Fill out all profile fields', category: 'onboarding', iconName: 'UserCheck', rarity: 'common' },
  'first-connection': { id: 'first-connection', name: 'First Connection', description: 'Connect your first external tool', category: 'onboarding', iconName: 'Link', rarity: 'common' },
  'first-task': { id: 'first-task', name: 'First Task', description: 'Complete your first task', category: 'projects', iconName: 'CheckCircle', rarity: 'common' },
  'task-10': { id: 'task-10', name: 'Task Veteran', description: 'Complete 10 tasks', category: 'projects', iconName: 'ListChecks', rarity: 'uncommon' },
  'task-50': { id: 'task-50', name: 'Task Master', description: 'Complete 50 tasks', category: 'projects', iconName: 'Layers', rarity: 'rare' },
  'task-100': { id: 'task-100', name: 'Century Club', description: 'Complete 100 tasks', category: 'projects', iconName: 'Crown', rarity: 'epic' },
  'first-five-star': { id: 'first-five-star', name: 'Five Stars', description: 'Receive your first 5-star review', category: 'projects', iconName: 'Star', rarity: 'uncommon' },
  'qa-perfect': { id: 'qa-perfect', name: 'QA Perfect', description: 'Score 100/100 on a QA check', category: 'quality', iconName: 'ShieldCheck', rarity: 'uncommon' },
  'zero-revisions-5': { id: 'zero-revisions-5', name: 'Flawless Five', description: '5 consecutive tasks with zero revisions', category: 'quality', iconName: 'Sparkles', rarity: 'rare' },
  'on-time-10': { id: 'on-time-10', name: 'On-Time Champion', description: '10 consecutive on-time deliveries', category: 'quality', iconName: 'Clock', rarity: 'rare' },
  'first-post': { id: 'first-post', name: 'First Post', description: 'Create your first community post', category: 'community', iconName: 'MessageSquare', rarity: 'common' },
  'helpful-10': { id: 'helpful-10', name: 'Helpful', description: 'Receive 10 upvotes', category: 'community', iconName: 'ThumbsUp', rarity: 'uncommon' },
  'mentor-50': { id: 'mentor-50', name: 'Mentor', description: 'Write 50 community replies', category: 'community', iconName: 'Heart', rarity: 'rare' },
  'streak-7': { id: 'streak-7', name: 'Week Warrior', description: '7-day activity streak', category: 'streaks', iconName: 'Flame', rarity: 'common' },
  'streak-30': { id: 'streak-30', name: 'Monthly Grind', description: '30-day activity streak', category: 'streaks', iconName: 'Flame', rarity: 'uncommon' },
  'streak-100': { id: 'streak-100', name: 'Unstoppable', description: '100-day activity streak', category: 'streaks', iconName: 'Flame', rarity: 'epic' },
  'level-5': { id: 'level-5', name: 'Expert Status', description: 'Reach Level 5', category: 'milestones', iconName: 'Award', rarity: 'rare' },
  'level-8': { id: 'level-8', name: 'Legendary', description: 'Reach Level 8', category: 'milestones', iconName: 'Trophy', rarity: 'legendary' },
  'earned-10k': { id: 'earned-10k', name: '$10K Club', description: 'Earn $10,000 cumulative', category: 'milestones', iconName: 'DollarSign', rarity: 'rare' },
  'earned-50k': { id: 'earned-50k', name: '$50K Club', description: 'Earn $50,000 cumulative', category: 'milestones', iconName: 'Banknote', rarity: 'epic' },
};
