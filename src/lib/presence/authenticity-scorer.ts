/**
 * Authenticity scorer — analyzes activity signals to detect
 * mouse jigglers, auto-clickers, and other fake presence software.
 *
 * Returns a score 0-100 where:
 *   90-100: Clearly human
 *   70-89:  Probably human
 *   40-69:  Suspicious — low-quality activity
 *   0-39:   Likely automated
 */

import type { ActivitySignals } from './activity-collector';

export type PresenceStatus = 'active' | 'idle' | 'away' | 'suspicious';

export interface AuthenticityResult {
  score: number;          // 0-100
  status: PresenceStatus;
  flags: string[];        // Specific reasons for suspicion
}

export function scoreAuthenticity(signals: ActivitySignals): AuthenticityResult {
  const flags: string[] = [];
  let score = 50; // Start neutral

  const windowMs = signals.windowEnd - signals.windowStart;
  const windowSecs = windowMs / 1000;

  // No activity at all
  if (signals.totalInteractions === 0) {
    return { score: 0, status: windowSecs > 900 ? 'away' : 'idle', flags: ['no_activity'] };
  }

  // --- Mouse Analysis ---

  // 1. Speed variance (jigglers have very low variance)
  if (signals.mouseMovements > 10) {
    if (signals.mouseSpeedVariance < 0.001 && signals.mouseMovements > 50) {
      score -= 30;
      flags.push('mouse_speed_constant');
    } else if (signals.mouseSpeedVariance > 0.01) {
      score += 10; // Good — natural variance
    }
  }

  // 2. Direction changes (jigglers move in straight lines or simple patterns)
  if (signals.mouseMovements > 20) {
    const dirChangeRate = signals.mouseDirectionChanges / signals.mouseMovements;
    if (dirChangeRate < 0.05) {
      score -= 20;
      flags.push('mouse_path_too_smooth');
    } else if (dirChangeRate > 0.15) {
      score += 10; // Good — humans overshoot and correct
    }
  }

  // 3. Mouse position pattern detection (circular or oscillating)
  if (signals.mousePositions.length >= 10) {
    const patternScore = detectPattern(signals.mousePositions);
    if (patternScore > 0.8) {
      score -= 25;
      flags.push('mouse_repetitive_pattern');
    }
  }

  // 4. Mouse-only activity (no clicks, no keyboard = likely jiggler)
  if (signals.mouseMovements > 50 && signals.clicks === 0 && signals.keystrokes === 0) {
    score -= 25;
    flags.push('mouse_only_no_interaction');
  }

  // --- Click Analysis ---

  // 5. Clicks that hit interactive elements (humans click on buttons/links)
  if (signals.clicks > 0) {
    const hitRate = signals.clicksOnElements / signals.clicks;
    if (hitRate > 0.5) {
      score += 15; // Most clicks hit real elements — human
    } else if (hitRate < 0.1 && signals.clicks > 5) {
      score -= 15;
      flags.push('clicks_miss_elements');
    }
  }

  // 6. Click position variance (auto-clickers click the same spot)
  if (signals.clicks > 3 && signals.clickPositionVariance < 100) {
    score -= 15;
    flags.push('clicks_same_position');
  }

  // --- Keyboard Analysis ---

  // 7. Keystrokes in fields (real work involves typing)
  if (signals.keystrokes > 0) {
    score += 10;
    if (signals.keystrokesInFields > 0) {
      score += 5; // Actually typing in input fields
    }
  }

  // 8. Keystroke timing (auto-typers have metronomic timing)
  if (signals.keystrokes > 10 && signals.keystrokeTimingVariance < 50) {
    score -= 15;
    flags.push('keystroke_timing_robotic');
  }

  // --- Scroll Analysis ---

  if (signals.scrollEvents > 0) {
    score += 5;
    if (signals.scrollDirectionChanges > 0) {
      score += 5; // Scrolling up and down = reading
    }
  }

  // --- Navigation ---

  if (signals.pageChanges > 0) {
    score += 10; // Actually navigating the app
  }

  // --- Interaction density check ---
  // Too many events per second = script, not human
  const eventsPerSec = signals.totalInteractions / Math.max(windowSecs, 1);
  if (eventsPerSec > 50) {
    score -= 20;
    flags.push('interaction_rate_superhuman');
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // Determine status
  let status: PresenceStatus;
  if (score >= 70) {
    status = 'active';
  } else if (score >= 40) {
    status = 'suspicious';
  } else if (signals.totalInteractions > 0) {
    status = 'suspicious';
  } else {
    status = 'idle';
  }

  return { score, status, flags };
}

/**
 * Detect repetitive patterns in mouse positions.
 * Returns 0-1 where 1 = highly repetitive (likely automated).
 */
function detectPattern(positions: Array<{ x: number; y: number; t: number }>): number {
  if (positions.length < 6) return 0;

  // Check for oscillation (back-and-forth)
  let oscillations = 0;
  for (let i = 2; i < positions.length; i++) {
    const dx1 = positions[i - 1].x - positions[i - 2].x;
    const dx2 = positions[i].x - positions[i - 1].x;
    const dy1 = positions[i - 1].y - positions[i - 2].y;
    const dy2 = positions[i].y - positions[i - 1].y;

    // Direction reversed on both axes
    if ((dx1 > 0 && dx2 < 0) || (dx1 < 0 && dx2 > 0)) {
      if ((dy1 > 0 && dy2 < 0) || (dy1 < 0 && dy2 > 0)) {
        oscillations++;
      }
    }
  }

  const oscillationRate = oscillations / (positions.length - 2);

  // Check for circular motion (constant radius from centroid)
  const cx = positions.reduce((s, p) => s + p.x, 0) / positions.length;
  const cy = positions.reduce((s, p) => s + p.y, 0) / positions.length;
  const radii = positions.map((p) => Math.sqrt(Math.pow(p.x - cx, 2) + Math.pow(p.y - cy, 2)));
  const meanRadius = radii.reduce((a, b) => a + b, 0) / radii.length;
  const radiusVariance = radii.reduce((sum, r) => sum + Math.pow(r - meanRadius, 2), 0) / radii.length;
  const radiusCV = meanRadius > 0 ? Math.sqrt(radiusVariance) / meanRadius : 0;

  // Low radius CV = circular motion (jiggler)
  const circularScore = radiusCV < 0.15 && meanRadius > 5 ? 0.8 : 0;

  return Math.max(oscillationRate, circularScore);
}
