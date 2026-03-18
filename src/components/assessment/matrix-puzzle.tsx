'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MotionDiv } from '@/components/motion/motion-div';
import { motion } from 'framer-motion';

interface MatrixPuzzleProps {
  svgGrid: string;
  svgOptions: string[];
  correctIndex: number;
  questionNumber: number;
  difficulty: string;
  onSubmit: (selectedIndex: number, isCorrect: boolean) => void;
  submitting?: boolean;
}

export function MatrixPuzzle({
  svgGrid,
  svgOptions,
  correctIndex,
  questionNumber,
  difficulty,
  onSubmit,
  submitting,
}: MatrixPuzzleProps) {
  const [selected, setSelected] = useState<number | null>(null);

  function handleSubmit() {
    if (selected === null || submitting) return;
    onSubmit(selected, selected === correctIndex);
  }

  return (
    <MotionDiv preset="fadeInUp" className="space-y-6">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">Q{questionNumber}</Badge>
        <Badge variant="secondary" className="text-xs">Pattern Recognition</Badge>
        <Badge className="text-xs capitalize bg-primary text-white">{difficulty}</Badge>
      </div>

      <p className="text-sm text-muted-foreground">
        Find the missing piece that completes the pattern in the grid below.
      </p>

      {/* Matrix grid */}
      <div className="flex justify-center">
        <div
          className="bg-card rounded-lg border border-border p-4"
          dangerouslySetInnerHTML={{ __html: svgGrid }}
        />
      </div>

      {/* Answer options */}
      <div>
        <p className="text-sm font-medium mb-3">Select your answer:</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {svgOptions.map((svg, idx) => (
            <motion.button
              key={idx}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelected(idx)}
              className={`p-2 rounded-lg border-2 transition-colors ${
                selected === idx
                  ? 'border-primary bg-primary-glow'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div dangerouslySetInnerHTML={{ __html: svg }} />
              <span className="text-xs text-muted-foreground mt-1 block">
                {String.fromCharCode(65 + idx)}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={selected === null || submitting}>
          Submit Answer
        </Button>
      </div>
    </MotionDiv>
  );
}
