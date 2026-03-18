// src/hooks/use-community.ts
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPosts, getPost, getReplies, createPost, createReply,
  upvotePost, getPublicActivity, queryLeaderboard,
  type SortOption,
} from '@/services/community';
import type { PostCategory } from '@/types/community';

export function usePosts(category?: PostCategory, sort: SortOption = 'recent') {
  return useQuery({
    queryKey: ['communityPosts', category, sort],
    queryFn: () => getPosts(category, sort),
    staleTime: 30_000,
  });
}

export function usePost(postId: string | undefined) {
  return useQuery({
    queryKey: ['communityPost', postId],
    queryFn: () => getPost(postId!),
    enabled: !!postId,
  });
}

export function useReplies(postId: string | undefined) {
  return useQuery({
    queryKey: ['communityReplies', postId],
    queryFn: () => getReplies(postId!),
    enabled: !!postId,
  });
}

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createPost,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['communityPosts'] }),
  });
}

export function useCreateReply(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reply: Parameters<typeof createReply>[1]) => createReply(postId, reply),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['communityReplies', postId] });
      qc.invalidateQueries({ queryKey: ['communityPost', postId] });
    },
  });
}

export function useUpvote(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => upvotePost(postId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['communityPost', postId] }),
  });
}

export function useLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => queryLeaderboard(),
    staleTime: 60_000,
  });
}

export function usePublicActivity() {
  return useQuery({
    queryKey: ['publicActivity'],
    queryFn: () => getPublicActivity(),
    staleTime: 30_000,
  });
}
