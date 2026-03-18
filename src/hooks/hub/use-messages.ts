import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listThreads,
  listThreadsByClient,
  listMessages,
  createThread,
  postMessage,
  addTranslation,
} from '@/services/hub/messages';
import type { CreateThreadInput, PostMessageInput } from '@/types/hub';
import { Timestamp } from 'firebase/firestore';

export function useThreads(workspaceId: string) {
  return useQuery({
    queryKey: ['threads', workspaceId],
    queryFn: () => listThreads(workspaceId),
    enabled: !!workspaceId,
  });
}

export function useClientThreads(clientId: string) {
  return useQuery({
    queryKey: ['threads-client', clientId],
    queryFn: () => listThreadsByClient(clientId),
    enabled: !!clientId,
  });
}

export function useMessages(
  threadId: string,
  options?: { pageSize?: number; afterTimestamp?: Timestamp }
) {
  return useQuery({
    queryKey: ['messages', threadId, options],
    queryFn: () => listMessages(threadId, options),
    enabled: !!threadId,
  });
}

export function useMessageMutations(workspaceId: string) {
  const queryClient = useQueryClient();

  const createThreadMut = useMutation({
    mutationFn: (input: CreateThreadInput) => createThread(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['threads', workspaceId] }),
  });

  const postMessageMut = useMutation({
    mutationFn: ({
      threadId,
      input,
    }: {
      threadId: string;
      input: PostMessageInput;
    }) => postMessage(threadId, input),
    onSuccess: (_, { threadId }) => {
      queryClient.invalidateQueries({ queryKey: ['messages', threadId] });
      queryClient.invalidateQueries({ queryKey: ['threads', workspaceId] });
    },
  });

  const addTranslationMut = useMutation({
    mutationFn: ({
      threadId,
      messageId,
      locale,
      text,
    }: {
      threadId: string;
      messageId: string;
      locale: string;
      text: string;
    }) => addTranslation(threadId, messageId, locale, text),
    onSuccess: (_, { threadId }) =>
      queryClient.invalidateQueries({ queryKey: ['messages', threadId] }),
  });

  return {
    createThread: createThreadMut,
    postMessage: postMessageMut,
    addTranslation: addTranslationMut,
  };
}
