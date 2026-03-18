import { useQuery } from '@tanstack/react-query';
import { listActivityEvents } from '@/services/hub/activity';
import type { ProviderId, ActivitySourceType } from '@/types/hub';

interface ActivityFilters {
  provider?: ProviderId;
  sourceType?: ActivitySourceType;
  since?: Date;
  limit?: number;
}

export function useActivityEvents(
  freelancerId: string,
  workspaceId: string,
  filters?: ActivityFilters
) {
  return useQuery({
    queryKey: ['activity', freelancerId, workspaceId, filters],
    queryFn: () => listActivityEvents(freelancerId, workspaceId, filters),
    enabled: !!freelancerId && !!workspaceId,
  });
}
