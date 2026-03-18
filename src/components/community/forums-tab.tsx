'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePosts } from '@/hooks/use-community';
import { UserCard } from './user-card';
import { UpvoteButton } from './upvote-button';
import { PostCompose } from './post-compose';
import type { PostCategory } from '@/types/community';
import type { SortOption } from '@/services/community';

const CATEGORIES: { value: PostCategory | undefined; label: string }[] = [
  { value: undefined, label: 'All' },
  { value: 'general', label: 'General' },
  { value: 'showcase', label: 'Showcase' },
  { value: 'help', label: 'Help' },
  { value: 'hiring', label: 'Hiring' },
  { value: 'feedback', label: 'Feedback' },
];

const SORTS: { value: SortOption; label: string }[] = [
  { value: 'recent', label: 'Recent' },
  { value: 'popular', label: 'Popular' },
  { value: 'unanswered', label: 'Unanswered' },
];

interface ForumsTabProps {
  onSelectPost: (postId: string) => void;
}

export function ForumsTab({ onSelectPost }: ForumsTabProps) {
  const [category, setCategory] = useState<PostCategory | undefined>(undefined);
  const [sort, setSort] = useState<SortOption>('recent');
  const [composing, setComposing] = useState(false);
  const { data: posts, isLoading } = usePosts(category, sort);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.label}
              onClick={() => setCategory(c.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                category === c.value ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {SORTS.map((s) => (
              <button
                key={s.value}
                onClick={() => setSort(s.value)}
                className={`rounded-md px-2 py-1 text-xs transition-colors ${
                  sort === s.value ? 'bg-gray-200 text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => setComposing(true)}>
            <Plus className="mr-1 h-4 w-4" /> New Post
          </Button>
        </div>
      </div>

      {composing && <PostCompose onClose={() => setComposing(false)} />}

      {/* Post list */}
      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading posts...</div>
      ) : !posts?.length ? (
        <div className="py-8 text-center text-sm text-muted-foreground">No posts yet. Be the first!</div>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <button
              key={post.id}
              onClick={() => onSelectPost(post.id)}
              className="flex w-full items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-left transition-colors hover:border-primary/30 hover:bg-gray-100"
            >
              <UpvoteButton postId={post.id} count={post.upvotes} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-600">{post.category}</span>
                  <h3 className="text-sm font-semibold truncate">{post.title}</h3>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <UserCard name={post.authorName} level={post.authorLevel} levelTitle={post.authorLevelTitle} />
                  <span>{post.replyCount} replies</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
