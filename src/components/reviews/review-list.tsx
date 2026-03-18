'use client';

import { useState } from 'react';
import { StarRating } from './star-rating';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ShieldCheck } from 'lucide-react';
import { submitFreelancerReply } from '@/services/reviews';
import { useToast } from '@/hooks/use-toast';
import type { Review } from '@/types/review';

interface ReviewListProps {
  reviews: Review[];
  isFreelancerView?: boolean; // Show reply option
}

export function ReviewList({ reviews, isFreelancerView = false }: ReviewListProps) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const { toast } = useToast();

  const handleReply = async (reviewId: string) => {
    if (!replyText.trim()) return;
    try {
      await submitFreelancerReply(reviewId, replyText.trim());
      setReplyingTo(null);
      setReplyText('');
      toast({ title: 'Reply posted' });
    } catch {
      toast({ title: 'Error', description: 'Failed to post reply.', variant: 'destructive' });
    }
  };

  if (reviews.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No reviews yet.</p>;
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <div key={review.id} className="rounded-lg border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-semibold">{review.clientName}</p>
              <p className="text-xs text-muted-foreground">{review.projectTitle}</p>
            </div>
            <div className="flex items-center gap-2">
              {review.isVerified && (
                <ShieldCheck className="h-4 w-4 text-primary" title="Verified review" />
              )}
              <StarRating value={review.rating} readonly size="sm" />
            </div>
          </div>

          <p className="text-sm mb-3">{review.comment}</p>

          {review.freelancerReply && (
            <div className="ml-4 mt-2 rounded-lg bg-muted/50 p-3 border-l-2 border-primary">
              <p className="text-xs font-medium text-muted-foreground mb-1">Freelancer reply</p>
              <p className="text-sm">{review.freelancerReply}</p>
            </div>
          )}

          {isFreelancerView && !review.freelancerReply && (
            <>
              {replyingTo === review.id ? (
                <div className="mt-3 space-y-2">
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write your reply..."
                    className="min-h-[60px]"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleReply(review.id)}>Post Reply</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setReplyingTo(null); setReplyText(''); }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="ghost" className="mt-2 text-xs" onClick={() => setReplyingTo(review.id)}>
                  Reply
                </Button>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
