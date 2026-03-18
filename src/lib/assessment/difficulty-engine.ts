import { DIFFICULTY_LEVELS, type DifficultyLevel } from '@/types/assessment';

interface DomainState {
  currentDifficulty: DifficultyLevel;
  consecutiveFailures: number; // at same level
  consecutiveAces: number; // at expert+
  locked: boolean; // ceiling detected
}

export class DifficultyEngine {
  private domains: Map<string, DomainState> = new Map();

  getState(domain: string): DomainState {
    if (!this.domains.has(domain)) {
      this.domains.set(domain, {
        currentDifficulty: 'beginner',
        consecutiveFailures: 0,
        consecutiveAces: 0,
        locked: false,
      });
    }
    return this.domains.get(domain)!;
  }

  getDifficulty(domain: string): DifficultyLevel {
    return this.getState(domain).currentDifficulty;
  }

  isLocked(domain: string): boolean {
    return this.getState(domain).locked;
  }

  /**
   * Update difficulty based on a score. Returns the new difficulty level.
   */
  update(domain: string, score: number): DifficultyLevel {
    const state = this.getState(domain);
    if (state.locked) return state.currentDifficulty;

    const currentIdx = DIFFICULTY_LEVELS.indexOf(state.currentDifficulty);

    if (score >= 85) {
      // Ace
      state.consecutiveFailures = 0;
      state.consecutiveAces++;

      // Floor detection: 3 aces at expert+ → push to master
      if (state.consecutiveAces >= 3 && currentIdx >= 3) {
        state.currentDifficulty = 'master';
        state.consecutiveAces = 0;
      } else if (currentIdx < DIFFICULTY_LEVELS.length - 1) {
        state.currentDifficulty = DIFFICULTY_LEVELS[currentIdx + 1];
        state.consecutiveAces = 0;
      }
    } else if (score < 40) {
      // Fail
      state.consecutiveAces = 0;
      state.consecutiveFailures++;

      // Ceiling detection: 2 consecutive failures at same level
      if (state.consecutiveFailures >= 2) {
        state.locked = true;
      } else if (currentIdx > 0) {
        state.currentDifficulty = DIFFICULTY_LEVELS[currentIdx - 1];
      }
    } else {
      // Same level (40-84)
      state.consecutiveFailures = 0;
      state.consecutiveAces = 0;
    }

    return state.currentDifficulty;
  }
}
