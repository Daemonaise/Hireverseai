'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, Clock } from 'lucide-react';
import { MotionDiv } from '@/components/motion/motion-div';

interface PracticalChallengeProps {
  challengeText: string;
  expectedDeliverableType: string;
  estimatedMinutes: number;
  primarySkill: string;
  onSubmit: (answer: string) => void;
  submitting?: boolean;
}

export function PracticalChallenge({
  challengeText,
  expectedDeliverableType,
  estimatedMinutes,
  primarySkill,
  onSubmit,
  submitting,
}: PracticalChallengeProps) {
  const [answer, setAnswer] = useState('');

  function handleSubmit() {
    if (answer.trim().length < 50 || submitting) return;
    onSubmit(answer.trim());
  }

  return (
    <MotionDiv preset="fadeInUp" className="space-y-5">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">Practical Challenge</Badge>
        <Badge variant="secondary" className="text-xs capitalize">{primarySkill}</Badge>
        <Badge variant="outline" className="text-xs">
          <Clock className="h-3 w-3 mr-1" />
          ~{estimatedMinutes} min
        </Badge>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="prose prose-sm max-w-none whitespace-pre-wrap">
          {challengeText}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Expected deliverable: <span className="font-medium capitalize">{expectedDeliverableType}</span>.
        Take your time — quality matters more than speed.
      </p>

      <Textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Type your response here... (minimum 50 characters)"
        rows={12}
        className="resize-none font-mono text-sm"
        onPaste={(e) => e.preventDefault()}
      />

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {answer.length} characters {answer.length < 50 && '(minimum 50)'}
        </p>
        <Button onClick={handleSubmit} disabled={answer.trim().length < 50 || submitting}>
          {submitting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Submit Challenge
        </Button>
      </div>
    </MotionDiv>
  );
}
