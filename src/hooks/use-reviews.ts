'use client';

import { useQuery } from '@tanstack/react-query';
import { getFreelancerReviews, getPendingReviewPrompts } from '@/services/reviews';

export function useFreelancerReviews(freelancerId: string | undefined) {
  return useQuery({
    queryKey: ['reviews', freelancerId],
    queryFn: () => getFreelancerReviews(freelancerId!),
    enabled: !!freelancerId,
    staleTime: 60_000,
  });
}

export function usePendingReviewPrompts(clientId: string | undefined) {
  return useQuery({
    queryKey: ['reviewPrompts', clientId],
    queryFn: () => getPendingReviewPrompts(clientId!),
    enabled: !!clientId,
    staleTime: 30_000,
  });
}
