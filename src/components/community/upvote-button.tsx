'use client';

import { useState, useEffect } from 'react';
import { ArrowBigUp } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { hasUserVoted } from '@/services/community';
import { useUpvote } from '@/hooks/use-community';
import { cn } from '@/lib/utils';

interface UpvoteButtonProps {
  postId: string;
  count: number;
}

export function UpvoteButton({ postId, count }: UpvoteButtonProps) {
  const { user } = useAuth();
  const upvote = useUpvote(postId);
  const [hasVoted, setHasVoted] = useState(false);

  useEffect(() => {
    if (!user) return;
    hasUserVoted(postId, user.uid).then(setHasVoted);
  }, [postId, user]);

  const handleVote = () => {
    if (!user || hasVoted) return;
    upvote.mutate(user.uid, {
      onSuccess: (voted) => { if (voted) setHasVoted(true); },
    });
  };

  return (
    <button
      onClick={handleVote}
      disabled={!user || hasVoted}
      className={cn(
        'flex items-center gap-1 rounded-md px-2 py-1 text-sm transition-colors',
        hasVoted
          ? 'text-primary bg-primary/10'
          : 'text-muted-foreground hover:text-primary hover:bg-primary/5',
      )}
    >
      <ArrowBigUp className={cn('h-4 w-4', hasVoted && 'fill-primary')} />
      {count}
    </button>
  );
}
