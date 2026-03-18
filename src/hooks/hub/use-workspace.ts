import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getWorkspace,
  listWorkspaces,
  createWorkspace,
  updateWorkspace,
  archiveWorkspace,
} from '@/services/hub/workspaces';
import type { Workspace, CreateWorkspaceInput, WorkspaceStatus } from '@/types/hub';

export function useWorkspace(freelancerId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['workspace', freelancerId, workspaceId],
    queryFn: () => getWorkspace(freelancerId, workspaceId),
    enabled: !!freelancerId && !!workspaceId,
  });
}

export function useWorkspaces(freelancerId: string, status?: WorkspaceStatus) {
  return useQuery({
    queryKey: ['workspaces', freelancerId, status],
    queryFn: () => listWorkspaces(freelancerId, status),
    enabled: !!freelancerId,
  });
}

export function useWorkspaceMutations(freelancerId: string) {
  const queryClient = useQueryClient();
  const baseKey = ['workspaces', freelancerId];

  const create = useMutation({
    mutationFn: (input: CreateWorkspaceInput) =>
      createWorkspace(freelancerId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: baseKey }),
  });

  const update = useMutation({
    mutationFn: ({
      workspaceId,
      data,
    }: {
      workspaceId: string;
      data: Partial<Pick<Workspace, 'name' | 'clientName' | 'engagementType' | 'status'>>;
    }) => updateWorkspace(freelancerId, workspaceId, data),
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: baseKey });
      queryClient.invalidateQueries({
        queryKey: ['workspace', freelancerId, workspaceId],
      });
    },
  });

  const archive = useMutation({
    mutationFn: (workspaceId: string) =>
      archiveWorkspace(freelancerId, workspaceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: baseKey }),
  });

  return { create, update, archive };
}
