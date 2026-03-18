import type { ProctorSignals, DifficultyLevel } from '@/types/assessment';

/**
 * Collects behavioral signals during an assessment session.
 * Call start() to begin collecting, stop() to detach listeners.
 * Read signals at any time via getSignals().
 */
export class Proctor {
  private signals: ProctorSignals = {
    tabSwitchCount: 0,
    totalTimeAwayMs: 0,
    pasteAttempts: 0,
    mouseExits: 0,
    rightClickAttempts: 0,
    devToolsDetected: false,
    keystrokeIntervals: [],
    questionTimings: [],
  };

  private lastVisibilityChange = 0;
  private lastKeystrokeTime = 0;
  private cleanup: (() => void)[] = [];

  getSignals(): ProctorSignals {
    return { ...this.signals };
  }

  recordQuestionTiming(questionId: string, timeMs: number, difficulty: DifficultyLevel) {
    this.signals.questionTimings.push({ questionId, timeMs, difficulty });
  }

  start() {
    // Tab visibility
    const onVisibility = () => {
      if (document.hidden) {
        this.lastVisibilityChange = Date.now();
        this.signals.tabSwitchCount++;
      } else if (this.lastVisibilityChange > 0) {
        this.signals.totalTimeAwayMs += Date.now() - this.lastVisibilityChange;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    this.cleanup.push(() => document.removeEventListener('visibilitychange', onVisibility));

    // Paste prevention
    const onPaste = (e: Event) => {
      e.preventDefault();
      this.signals.pasteAttempts++;
    };
    document.addEventListener('paste', onPaste, true);
    this.cleanup.push(() => document.removeEventListener('paste', onPaste, true));

    // Mouse leaving viewport
    const onMouseLeave = () => { this.signals.mouseExits++; };
    document.addEventListener('mouseleave', onMouseLeave);
    this.cleanup.push(() => document.removeEventListener('mouseleave', onMouseLeave));

    // Right-click prevention
    const onContextMenu = (e: Event) => {
      e.preventDefault();
      this.signals.rightClickAttempts++;
    };
    document.addEventListener('contextmenu', onContextMenu);
    this.cleanup.push(() => document.removeEventListener('contextmenu', onContextMenu));

    // Keystroke cadence (sample intervals between keystrokes)
    const onKeyDown = () => {
      const now = Date.now();
      if (this.lastKeystrokeTime > 0) {
        const interval = now - this.lastKeystrokeTime;
        // Only keep last 200 intervals to avoid memory bloat
        if (this.signals.keystrokeIntervals.length < 200) {
          this.signals.keystrokeIntervals.push(interval);
        }
      }
      this.lastKeystrokeTime = now;
    };
    document.addEventListener('keydown', onKeyDown);
    this.cleanup.push(() => document.removeEventListener('keydown', onKeyDown));

    // DevTools detection (window resize heuristic)
    const threshold = 160; // DevTools typically takes 160px+
    const onResize = () => {
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      if (widthDiff > threshold || heightDiff > threshold) {
        this.signals.devToolsDetected = true;
      }
    };
    window.addEventListener('resize', onResize);
    this.cleanup.push(() => window.removeEventListener('resize', onResize));

    // F12 / Ctrl+Shift+I detection
    const onKeyCombo = (e: KeyboardEvent) => {
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
        e.preventDefault();
        this.signals.devToolsDetected = true;
      }
    };
    document.addEventListener('keydown', onKeyCombo);
    this.cleanup.push(() => document.removeEventListener('keydown', onKeyCombo));
  }

  stop() {
    for (const fn of this.cleanup) fn();
    this.cleanup = [];
  }
}
