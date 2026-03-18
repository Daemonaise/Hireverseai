// functions/src/utils/notifications.ts
import { db } from './firestore';
import { FieldValue } from 'firebase-admin/firestore';

interface NotificationData {
  type: 'xp_earned' | 'badge_earned' | 'level_up' | 'streak' | 'review_received';
  title: string;
  body: string;
  metadata?: Record<string, any>;
}

export async function writeNotification(userId: string, data: NotificationData): Promise<void> {
  await db.collection('notifications').doc(userId).collection('items').add({
    ...data,
    metadata: data.metadata ?? {},
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function writePublicActivity(
  freelancerId: string,
  freelancerName: string,
  type: 'level_up' | 'badge_earned' | 'streak_milestone',
  title: string,
  description: string,
): Promise<void> {
  await db.collection('publicActivity').add({
    freelancerId,
    freelancerName,
    type,
    title,
    description,
    createdAt: FieldValue.serverTimestamp(),
  });
}
