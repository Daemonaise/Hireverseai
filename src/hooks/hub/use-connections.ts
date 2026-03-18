import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listConnections,
  createConnection,
  deleteConnection,
  updateConnectionStatus,
} from '@/services/hub/connections';
import type { ProviderId, ConnectionStatus } from '@/types/hub';

export function useConnections(freelancerId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['connections', freelancerId, workspaceId],
    queryFn: () => listConnections(freelancerId, workspaceId),
    enabled: !!freelancerId && !!workspaceId,
  });
}

export function useConnectionMutations(
  freelancerId: string,
  workspaceId: string
) {
  const queryClient = useQueryClient();
  const key = ['connections', freelancerId, workspaceId];

  const create = useMutation({
    mutationFn: (data: {
      provider: ProviderId;
      nangoConnectionId: string;
      nangoIntegrationId: string;
      label: string;
      launchUrl: string;
    }) =>
      createConnection(
        freelancerId,
        workspaceId,
        data.provider,
        data.nangoConnectionId,
        data.nangoIntegrationId,
        data.label,
        data.launchUrl
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    mutationFn: ({
      connectionId,
      provider,
      label,
    }: {
      connectionId: string;
      provider?: ProviderId;
      label?: string;
    }) => deleteConnection(freelancerId, workspaceId, connectionId, provider, label),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const updateStatus = useMutation({
    mutationFn: ({
      connectionId,
      status,
    }: {
      connectionId: string;
      status: ConnectionStatus;
    }) => updateConnectionStatus(freelancerId, workspaceId, connectionId, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return { create, remove, updateStatus };
}
