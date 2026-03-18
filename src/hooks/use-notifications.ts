'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { GamificationNotification } from '@/types/gamification';

export function useNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<GamificationNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, 'notifications', userId, 'items'),
      orderBy('createdAt', 'desc'),
      limit(20),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: GamificationNotification[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as GamificationNotification);
      });
      setNotifications(items);
      setUnreadCount(items.filter((n) => !n.read).length);
    });

    return () => unsubscribe();
  }, [userId]);

  const markAsRead = async (notificationId: string) => {
    if (!userId) return;
    await updateDoc(doc(db, 'notifications', userId, 'items', notificationId), { read: true });
  };

  const markAllAsRead = async () => {
    if (!userId || notifications.length === 0) return;
    const batch = writeBatch(db);
    notifications
      .filter((n) => !n.read)
      .forEach((n) => {
        batch.update(doc(db, 'notifications', userId, 'items', n.id), { read: true });
      });
    await batch.commit();
  };

  return { notifications, unreadCount, markAsRead, markAllAsRead };
}
