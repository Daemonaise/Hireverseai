'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StarRating } from './star-rating';
import { submitReview, updateReviewPromptStatus } from '@/services/reviews';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import type { ReviewPrompt } from '@/types/review';

interface ReviewFormProps {
  prompt: ReviewPrompt;
  clientId: string;
  clientName: string;
  onComplete: () => void;
}

export function ReviewForm({ prompt, clientId, clientName, onComplete }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [categories, setCategories] = useState({ quality: 0, communication: 0, timeliness: 0, expertise: 0 });
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const updateCategory = (key: string, value: number) => {
    setCategories((prev) => ({ ...prev, [key]: value }));
  };

  const canSubmit = rating > 0 && comment.length >= 20 &&
    categories.quality > 0 && categories.communication > 0 &&
    categories.timeliness > 0 && categories.expertise > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      await submitReview({
        projectId: prompt.projectId,
        freelancerId: prompt.freelancerId,
        clientId,
        clientName,
        projectTitle: prompt.projectTitle,
        rating,
        categories,
        comment,
        isVerified: true,
      });
      await updateReviewPromptStatus(clientId, prompt.projectId, 'completed');
      toast({ title: 'Review submitted', description: 'Thank you for your feedback.' });
      onComplete();
    } catch {
      toast({ title: 'Error', description: 'Failed to submit review.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismiss = async () => {
    await updateReviewPromptStatus(clientId, prompt.projectId, 'dismissed');
    onComplete();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Review: {prompt.projectTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Overall Rating</label>
          <StarRating value={rating} onChange={setRating} size="lg" />
        </div>

        {(['quality', 'communication', 'timeliness', 'expertise'] as const).map((key) => (
          <div key={key} className="flex items-center justify-between">
            <label className="text-sm capitalize">{key}</label>
            <StarRating value={categories[key]} onChange={(v) => updateCategory(key, v)} size="sm" />
          </div>
        ))}

        <div>
          <label className="text-sm font-medium mb-1 block">Comment (min 20 chars)</label>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience working with this freelancer..."
            className="min-h-[80px]"
          />
        </div>

        <div className="flex justify-between">
          <Button variant="ghost" size="sm" onClick={handleDismiss}>Skip</Button>
          <Button size="sm" onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
            {isSubmitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Submit Review
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
