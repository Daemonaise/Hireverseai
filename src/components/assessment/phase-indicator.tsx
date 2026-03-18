'use client';

import { motion } from 'framer-motion';
import type { AssessmentPhase } from '@/types/assessment';

interface PhaseIndicatorProps {
  currentPhase: AssessmentPhase;
  questionNumber: number;
  totalQuestions: number;
}

const PHASES = [
  { id: 1 as AssessmentPhase, label: 'Skill Proficiency', description: '20-25 questions' },
  { id: 2 as AssessmentPhase, label: 'Cognitive Battery', description: '15-20 questions' },
  { id: 3 as AssessmentPhase, label: 'Practical Challenge', description: '1-2 tasks' },
];

export function PhaseIndicator({ currentPhase, questionNumber, totalQuestions }: PhaseIndicatorProps) {
  const progress = totalQuestions > 0 ? Math.min(questionNumber / totalQuestions, 1) : 0;

  return (
    <div className="space-y-3">
      {/* Phase steps */}
      <div className="flex items-center gap-2">
        {PHASES.map((phase, idx) => (
          <div key={phase.id} className="flex items-center gap-2">
            <div
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${
                currentPhase === phase.id
                  ? 'bg-primary text-primary-foreground'
                  : currentPhase > phase.id
                    ? 'bg-accent-green text-white'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {currentPhase > phase.id ? '✓' : phase.id}
            </div>
            <span
              className={`text-xs font-medium hidden sm:inline ${
                currentPhase === phase.id ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {phase.label}
            </span>
            {idx < PHASES.length - 1 && (
              <div className={`w-8 h-px ${currentPhase > phase.id ? 'bg-accent-green' : 'bg-muted'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Question {questionNumber} of ~{totalQuestions}
      </p>
    </div>
  );
}
