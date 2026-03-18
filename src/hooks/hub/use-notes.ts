import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listNotes,
  addNote,
  updateNote,
  deleteNote,
} from '@/services/hub/notes';
import type { CreateNoteInput, Note } from '@/types/hub';

export function useNotes(freelancerId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['notes', freelancerId, workspaceId],
    queryFn: () => listNotes(freelancerId, workspaceId),
    enabled: !!freelancerId && !!workspaceId,
  });
}

export function useNoteMutations(freelancerId: string, workspaceId: string) {
  const queryClient = useQueryClient();
  const key = ['notes', freelancerId, workspaceId];

  const create = useMutation({
    mutationFn: (data: CreateNoteInput) =>
      addNote(freelancerId, workspaceId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const update = useMutation({
    mutationFn: ({
      noteId,
      data,
    }: {
      noteId: string;
      data: Partial<Pick<Note, 'title' | 'content'>>;
    }) => updateNote(freelancerId, workspaceId, noteId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    mutationFn: (noteId: string) =>
      deleteNote(freelancerId, workspaceId, noteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return { create, update, remove };
}
