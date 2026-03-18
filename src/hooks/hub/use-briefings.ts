import { useQuery } from '@tanstack/react-query';
import {
  getLatestBriefing,
  listBriefings,
} from '@/services/hub/briefings';

export function useLatestBriefing(freelancerId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['briefing-latest', freelancerId, workspaceId],
    queryFn: () => getLatestBriefing(freelancerId, workspaceId),
    enabled: !!freelancerId && !!workspaceId,
  });
}

export function useBriefings(freelancerId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['briefings', freelancerId, workspaceId],
    queryFn: () => listBriefings(freelancerId, workspaceId),
    enabled: !!freelancerId && !!workspaceId,
  });
}
