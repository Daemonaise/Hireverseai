// functions/src/gamification/levels.ts

interface LevelInfo {
  level: number;
  title: string;
  xpToNextLevel: number;
}

const LEVEL_THRESHOLDS = [
  { level: 1, title: 'Newcomer', cumulative: 0 },
  { level: 2, title: 'Apprentice', cumulative: 200 },
  { level: 3, title: 'Journeyman', cumulative: 700 },
  { level: 4, title: 'Specialist', cumulative: 1700 },
  { level: 5, title: 'Expert', cumulative: 3700 },
  { level: 6, title: 'Master', cumulative: 7700 },
  { level: 7, title: 'Grandmaster', cumulative: 15700 },
  { level: 8, title: 'Legend', cumulative: 31700 },
];

export function computeLevel(xp: number): LevelInfo {
  let current = LEVEL_THRESHOLDS[0];

  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i].cumulative) {
      current = LEVEL_THRESHOLDS[i];
      break;
    }
  }

  const nextIndex = LEVEL_THRESHOLDS.findIndex((t) => t.level === current.level + 1);
  const xpToNextLevel = nextIndex >= 0
    ? LEVEL_THRESHOLDS[nextIndex].cumulative - xp
    : 0; // Max level

  return {
    level: current.level,
    title: current.title,
    xpToNextLevel: Math.max(0, xpToNextLevel),
  };
}
