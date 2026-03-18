import type { ProctorSignals } from '@/types/assessment';

/**
 * Calculate session integrity score (0-100) from proctor signals.
 *
 * 90-100: Clean session
 * 70-89: Minor flags
 * 50-69: Moderate flags (unverified)
 * < 50: Session invalidated
 */
export function calculateIntegrityScore(signals: ProctorSignals): {
  score: number;
  flags: string[];
} {
  let score = 100;
  const flags: string[] = [];

  // Tab switches
  if (signals.tabSwitchCount >= 10) {
    score -= 30;
    flags.push(`Excessive tab switches: ${signals.tabSwitchCount}`);
  } else if (signals.tabSwitchCount >= 5) {
    score -= 15;
    flags.push(`Tab switches: ${signals.tabSwitchCount}`);
  } else if (signals.tabSwitchCount >= 2) {
    score -= 5;
  }

  // Time away
  const awaySeconds = signals.totalTimeAwayMs / 1000;
  if (awaySeconds > 120) {
    score -= 25;
    flags.push(`Time away: ${Math.round(awaySeconds)}s`);
  } else if (awaySeconds > 30) {
    score -= 10;
    flags.push(`Time away: ${Math.round(awaySeconds)}s`);
  }

  // Paste attempts
  if (signals.pasteAttempts > 5) {
    score -= 20;
    flags.push(`Paste attempts: ${signals.pasteAttempts}`);
  } else if (signals.pasteAttempts > 0) {
    score -= 5;
    flags.push(`Paste attempts: ${signals.pasteAttempts}`);
  }

  // Mouse exits
  if (signals.mouseExits > 20) {
    score -= 10;
    flags.push(`Mouse exits: ${signals.mouseExits}`);
  }

  // Right-click attempts
  if (signals.rightClickAttempts > 3) {
    score -= 5;
    flags.push(`Right-click attempts: ${signals.rightClickAttempts}`);
  }

  // DevTools
  if (signals.devToolsDetected) {
    score -= 20;
    flags.push('DevTools detected');
  }

  // Keystroke cadence analysis
  if (signals.keystrokeIntervals.length > 20) {
    const intervals = signals.keystrokeIntervals;
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, i) => sum + (i - avg) ** 2, 0) / intervals.length;
    const stdDev = Math.sqrt(variance);

    // Unnaturally consistent typing (bot-like): very low stdDev relative to avg
    if (stdDev < avg * 0.1 && avg < 200) {
      score -= 15;
      flags.push('Suspiciously consistent typing cadence');
    }
  }

  // Question timing anomalies
  for (const qt of signals.questionTimings) {
    const seconds = qt.timeMs / 1000;
    const isHard = ['advanced', 'expert', 'master'].includes(qt.difficulty);

    // Too fast on hard questions
    if (isHard && seconds < 5) {
      score -= 3;
      flags.push(`Suspiciously fast answer: ${qt.questionId} (${seconds.toFixed(1)}s on ${qt.difficulty})`);
    }

    // Too slow on easy questions
    if (qt.difficulty === 'beginner' && seconds > 600) {
      score -= 2;
      flags.push(`Very slow answer: ${qt.questionId} (${Math.round(seconds)}s on beginner)`);
    }
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    flags,
  };
}
