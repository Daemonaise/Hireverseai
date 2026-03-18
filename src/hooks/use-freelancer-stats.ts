'use client';

import { useQuery } from '@tanstack/react-query';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { FreelancerStats } from '@/types/gamification';

export function useFreelancerStats(freelancerId: string | undefined) {
  return useQuery({
    queryKey: ['freelancerStats', freelancerId],
    queryFn: async (): Promise<FreelancerStats | null> => {
      if (!freelancerId) return null;
      const snap = await getDoc(doc(db, 'freelancerStats', freelancerId));
      if (!snap.exists()) return null;
      return snap.data() as FreelancerStats;
    },
    enabled: !!freelancerId,
    staleTime: 30_000,
  });
}
