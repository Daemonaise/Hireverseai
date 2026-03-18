'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface TimerBarProps {
  durationSeconds: number;
  onExpire?: () => void;
  paused?: boolean;
}

export function TimerBar({ durationSeconds, onExpire, paused }: TimerBarProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= durationSeconds) {
          clearInterval(interval);
          onExpire?.();
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [durationSeconds, onExpire, paused]);

  useEffect(() => { setElapsed(0); }, [durationSeconds]);

  const progress = Math.min(elapsed / durationSeconds, 1);
  const remaining = Math.max(0, durationSeconds - elapsed);
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  const isUrgent = progress > 0.8;

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${isUrgent ? 'bg-accent-red' : 'bg-primary'}`}
          initial={{ width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      <span className={`text-xs font-mono tabular-nums ${isUrgent ? 'text-accent-red font-semibold' : 'text-muted-foreground'}`}>
        {minutes}:{seconds.toString().padStart(2, '0')}
      </span>
    </div>
  );
}
