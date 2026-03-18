'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MotionDiv } from '@/components/motion/motion-div';

interface SequenceRecallProps {
  sequence: (number | string)[];
  displayDurationMs: number;
  type: 'number' | 'color' | 'position';
  questionNumber: number;
  difficulty: string;
  onSubmit: (answer: string, correct: boolean) => void;
  submitting?: boolean;
}

const COLOR_MAP: Record<string, string> = {
  red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308',
  purple: '#a855f7', orange: '#f97316', pink: '#ec4899', cyan: '#06b6d4',
  white: '#f8fafc', gray: '#6b7280',
};

export function SequenceRecall({
  sequence,
  displayDurationMs,
  type,
  questionNumber,
  difficulty,
  onSubmit,
  submitting,
}: SequenceRecallProps) {
  const [phase, setPhase] = useState<'showing' | 'recalling'>('showing');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answer, setAnswer] = useState('');

  // Show items one at a time
  useEffect(() => {
    if (phase !== 'showing') return;

    const itemDuration = displayDurationMs / sequence.length;
    const timer = setInterval(() => {
      setCurrentIdx((prev) => {
        if (prev >= sequence.length - 1) {
          clearInterval(timer);
          setTimeout(() => setPhase('recalling'), 500);
          return prev;
        }
        return prev + 1;
      });
    }, itemDuration);

    return () => clearInterval(timer);
  }, [phase, displayDurationMs, sequence.length]);

  function handleSubmit() {
    if (!answer.trim() || submitting) return;
    const correctAnswer = sequence.join(type === 'color' ? ', ' : ' ');
    const isCorrect = answer.trim().toLowerCase() === correctAnswer.toLowerCase();
    onSubmit(answer.trim(), isCorrect);
  }

  return (
    <MotionDiv preset="fadeInUp" className="space-y-6">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">Q{questionNumber}</Badge>
        <Badge variant="secondary" className="text-xs">Working Memory</Badge>
        <Badge className="text-xs capitalize bg-primary text-white">{difficulty}</Badge>
      </div>

      {phase === 'showing' ? (
        <div className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Remember this sequence ({sequence.length} items):
          </p>

          <div className="flex justify-center items-center h-32">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIdx}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                className="flex items-center justify-center"
              >
                {type === 'color' ? (
                  <div
                    className="w-20 h-20 rounded-xl border-2 border-border shadow-lg"
                    style={{ backgroundColor: COLOR_MAP[sequence[currentIdx] as string] ?? '#888' }}
                  />
                ) : (
                  <span className="text-6xl font-bold text-foreground">
                    {sequence[currentIdx]}
                  </span>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex justify-center gap-1">
            {sequence.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i <= currentIdx ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Type the sequence you just saw
            {type === 'number' ? ' (space-separated numbers)' :
             type === 'color' ? ' (comma-separated colors)' :
             ' (space-separated grid positions)'}:
          </p>

          <Input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={
              type === 'number' ? 'e.g., 3 7 1 9 4' :
              type === 'color' ? 'e.g., red, blue, green' :
              'e.g., 1 5 3 8'
            }
            autoFocus
            onPaste={(e) => e.preventDefault()}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />

          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={!answer.trim() || submitting}>
              Submit Answer
            </Button>
          </div>
        </div>
      )}
    </MotionDiv>
  );
}
