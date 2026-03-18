'use client';

import { useEffect, useRef } from 'react';
import { Proctor } from '@/lib/assessment/proctor';
import type { ProctorSignals, DifficultyLevel } from '@/types/assessment';

/**
 * React hook that manages a Proctor instance.
 * Starts collecting behavioral signals on mount, stops on unmount.
 */
export function useProctor() {
  const proctorRef = useRef<Proctor | null>(null);

  useEffect(() => {
    const proctor = new Proctor();
    proctor.start();
    proctorRef.current = proctor;

    return () => {
      proctor.stop();
    };
  }, []);

  function getSignals(): ProctorSignals {
    return proctorRef.current?.getSignals() ?? {
      tabSwitchCount: 0,
      totalTimeAwayMs: 0,
      pasteAttempts: 0,
      mouseExits: 0,
      rightClickAttempts: 0,
      devToolsDetected: false,
      keystrokeIntervals: [],
      questionTimings: [],
    };
  }

  function recordQuestionTiming(questionId: string, timeMs: number, difficulty: DifficultyLevel) {
    proctorRef.current?.recordQuestionTiming(questionId, timeMs, difficulty);
  }

  return { getSignals, recordQuestionTiming };
}
