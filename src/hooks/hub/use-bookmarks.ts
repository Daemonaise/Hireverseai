import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listBookmarks,
  addBookmark,
  deleteBookmark,
} from '@/services/hub/bookmarks';
import type { CreateBookmarkInput } from '@/types/hub';

export function useBookmarks(freelancerId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['bookmarks', freelancerId, workspaceId],
    queryFn: () => listBookmarks(freelancerId, workspaceId),
    enabled: !!freelancerId && !!workspaceId,
  });
}

export function useBookmarkMutations(
  freelancerId: string,
  workspaceId: string
) {
  const queryClient = useQueryClient();
  const key = ['bookmarks', freelancerId, workspaceId];

  const add = useMutation({
    mutationFn: (data: CreateBookmarkInput) =>
      addBookmark(freelancerId, workspaceId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    mutationFn: (bookmarkId: string) =>
      deleteBookmark(freelancerId, workspaceId, bookmarkId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return { add, remove };
}
