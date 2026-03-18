'use client';

import { useState } from 'react';
import { ArrowLeft, Flag, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { usePost, useReplies, useCreateReply } from '@/hooks/use-community';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { flagContent, acceptReply } from '@/services/community';
import { UserCard } from './user-card';
import { UpvoteButton } from './upvote-button';

interface PostDetailProps {
  postId: string;
  onBack: () => void;
}

export function PostDetail({ postId, onBack }: PostDetailProps) {
  const { user } = useAuth();
  const { data: post } = usePost(postId);
  const { data: replies } = useReplies(postId);
  const createReply = useCreateReply(postId);
  const { toast } = useToast();
  const [replyText, setReplyText] = useState('');

  if (!post) return <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>;

  const handleReply = async () => {
    if (!user || !replyText.trim()) return;
    await createReply.mutateAsync({
      authorId: user.uid,
      authorName: user.displayName ?? 'Anonymous',
      authorLevel: 1,
      body: replyText.trim(),
    });
    setReplyText('');
  };

  const handleFlag = async () => {
    if (!user) return;
    await flagContent('post', postId, user.uid, 'Inappropriate content');
    toast({ title: 'Reported', description: 'This post has been flagged for review.' });
  };

  const handleAccept = async (replyId: string) => {
    await acceptReply(postId, replyId);
    toast({ title: 'Answer accepted' });
  };

  const isAuthor = user?.uid === post.authorId;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Back
      </Button>

      {/* Post */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">{post.category}</span>
            <UserCard name={post.authorName} level={post.authorLevel} levelTitle={post.authorLevelTitle} />
          </div>
          <div className="flex items-center gap-2">
            <UpvoteButton postId={post.id} count={post.upvotes} />
            <button onClick={handleFlag} className="text-muted-foreground hover:text-destructive" title="Flag">
              <Flag className="h-4 w-4" />
            </button>
          </div>
        </div>

        <h2 className="text-xl font-bold mb-2">{post.title}</h2>
        <p className="text-sm whitespace-pre-wrap">{post.body}</p>

        {post.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {post.tags.map((tag: string) => (
              <span key={tag} className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] text-gray-500">{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Replies */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">{replies?.length ?? 0} Replies</h3>
        {replies?.map((reply) => (
          <div key={reply.id} className={`rounded-lg border p-4 ${reply.isAccepted ? 'border-primary bg-primary/5' : 'border-gray-200 bg-white'}`}>
            <div className="flex items-center justify-between mb-2">
              <UserCard name={reply.authorName} level={reply.authorLevel} levelTitle="" />
              {reply.isAccepted && (
                <span className="flex items-center gap-1 text-xs text-primary font-medium">
                  <CheckCircle className="h-3 w-3" /> Accepted
                </span>
              )}
              {isAuthor && post.category === 'help' && !reply.isAccepted && (
                <Button size="sm" variant="ghost" className="text-xs" onClick={() => handleAccept(reply.id)}>
                  Accept Answer
                </Button>
              )}
            </div>
            <p className="text-sm whitespace-pre-wrap">{reply.body}</p>
          </div>
        ))}

        {/* Reply form */}
        {user && (
          <div className="flex gap-2">
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply..."
              className="min-h-[60px]"
            />
            <Button size="sm" onClick={handleReply} disabled={!replyText.trim() || createReply.isPending}>
              Reply
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
