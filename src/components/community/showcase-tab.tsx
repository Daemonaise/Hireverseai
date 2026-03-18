'use client';

import { usePosts } from '@/hooks/use-community';
import { UserCard } from './user-card';
import { UpvoteButton } from './upvote-button';

interface ShowcaseTabProps {
  onSelectPost: (postId: string) => void;
}

export function ShowcaseTab({ onSelectPost }: ShowcaseTabProps) {
  const { data: posts, isLoading } = usePosts('showcase', 'popular');

  if (isLoading) return <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>;

  if (!posts?.length) return <div className="py-8 text-center text-sm text-muted-foreground">No showcase posts yet.</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {posts.map((post) => (
        <button
          key={post.id}
          onClick={() => onSelectPost(post.id)}
          className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-left transition-all hover:border-primary/30 hover:-translate-y-0.5 hover:shadow-md"
        >
          <h3 className="text-sm font-semibold mb-1 truncate">{post.title}</h3>
          <p className="text-xs text-muted-foreground line-clamp-3 mb-3">{post.body}</p>
          <div className="flex items-center justify-between">
            <UserCard name={post.authorName} level={post.authorLevel} levelTitle={post.authorLevelTitle} />
            <UpvoteButton postId={post.id} count={post.upvotes} />
          </div>
          {post.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {post.tags.slice(0, 3).map((tag: string) => (
                <span key={tag} className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-500">{tag}</span>
              ))}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
