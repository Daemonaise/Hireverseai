'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2 } from 'lucide-react';
import { MotionDiv } from '@/components/motion/motion-div';

interface SkillQuestionProps {
  questionText: string;
  skillTested: string;
  difficulty: string;
  questionNumber: number;
  onSubmit: (answer: string) => void;
  submitting?: boolean;
}

export function SkillQuestion({
  questionText,
  skillTested,
  difficulty,
  questionNumber,
  onSubmit,
  submitting,
}: SkillQuestionProps) {
  const [answer, setAnswer] = useState('');

  function handleSubmit() {
    if (answer.trim().length < 10 || submitting) return;
    onSubmit(answer.trim());
    setAnswer('');
  }

  return (
    <MotionDiv preset="fadeInUp" className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">
          Q{questionNumber}
        </Badge>
        <Badge variant="secondary" className="text-xs capitalize">
          {skillTested}
        </Badge>
        <Badge
          className={`text-xs capitalize ${
            difficulty === 'master' ? 'bg-amber-500' :
            difficulty === 'expert' ? 'bg-purple-500' :
            difficulty === 'advanced' ? 'bg-blue-500' :
            difficulty === 'intermediate' ? 'bg-green-500' :
            'bg-gray-500'
          } text-white`}
        >
          {difficulty}
        </Badge>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="prose prose-sm max-w-none whitespace-pre-wrap">
          {questionText}
        </div>
      </div>

      <Textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Type your answer here... (minimum 10 characters)"
        rows={6}
        className="resize-none"
        onPaste={(e) => e.preventDefault()}
      />

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {answer.length} characters {answer.length < 10 && '(minimum 10)'}
        </p>
        <Button
          onClick={handleSubmit}
          disabled={answer.trim().length < 10 || submitting}
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Submit Answer
        </Button>
      </div>
    </MotionDiv>
  );
}
