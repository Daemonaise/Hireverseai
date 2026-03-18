/**
 * Number/pattern sequence generator for working memory and numerical reasoning.
 */

import type { DifficultyLevel } from '@/types/assessment';

interface SequencePuzzle {
  sequence: (number | string)[];
  answer: string;
  displayDurationMs: number; // For working memory tasks
  type: 'number' | 'color' | 'position';
}

function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

const COLORS_SEQ = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan', 'white', 'gray'];

/**
 * Generate a number sequence for recall (working memory).
 */
export function generateMemorySequence(seed: number, difficulty: DifficultyLevel): SequencePuzzle {
  const rng = seededRng(seed);

  const config = {
    beginner: { length: 4, duration: 3000 },
    intermediate: { length: 6, duration: 4000 },
    advanced: { length: 8, duration: 5000 },
    expert: { length: 10, duration: 5000 },
    master: { length: 12, duration: 5000 },
  }[difficulty];

  // Decide type
  const typeRoll = rng();
  let type: 'number' | 'color' | 'position';
  if (typeRoll < 0.5) type = 'number';
  else if (typeRoll < 0.8) type = 'color';
  else type = 'position';

  const sequence: (number | string)[] = [];

  if (type === 'number') {
    for (let i = 0; i < config.length; i++) {
      sequence.push(Math.floor(rng() * 9) + 1);
    }
  } else if (type === 'color') {
    for (let i = 0; i < config.length; i++) {
      sequence.push(COLORS_SEQ[Math.floor(rng() * COLORS_SEQ.length)]);
    }
  } else {
    // Grid positions (1-9 on a 3x3 grid)
    for (let i = 0; i < config.length; i++) {
      sequence.push(Math.floor(rng() * 9) + 1);
    }
  }

  return {
    sequence,
    answer: sequence.join(type === 'color' ? ', ' : ' '),
    displayDurationMs: config.duration,
    type,
  };
}

/**
 * Generate a number sequence puzzle for numerical reasoning.
 * "What comes next?"
 */
export function generateNumberSequence(seed: number, difficulty: DifficultyLevel): {
  sequence: number[];
  answer: number;
  rule: string;
} {
  const rng = seededRng(seed);

  const ruleType = Math.floor(rng() * 5);
  const start = Math.floor(rng() * 10) + 1;
  const step = Math.floor(rng() * 8) + 2;

  let seq: number[] = [];
  let answer: number;
  let rule: string;

  switch (ruleType) {
    case 0: {
      // Arithmetic: +step
      for (let i = 0; i < 5; i++) seq.push(start + step * i);
      answer = start + step * 5;
      rule = `Add ${step} each time`;
      break;
    }
    case 1: {
      // Geometric: *factor
      const factor = Math.floor(rng() * 3) + 2;
      let val = start;
      for (let i = 0; i < 5; i++) { seq.push(val); val *= factor; }
      answer = val;
      rule = `Multiply by ${factor} each time`;
      break;
    }
    case 2: {
      // Fibonacci-like: sum of previous two
      seq = [start, start + step];
      for (let i = 2; i < 5; i++) seq.push(seq[i - 1] + seq[i - 2]);
      answer = seq[3] + seq[4];
      rule = 'Sum of previous two numbers';
      break;
    }
    case 3: {
      // Alternating: +a, +b
      const a = step;
      const b = Math.floor(rng() * 5) + 1;
      let val2 = start;
      for (let i = 0; i < 5; i++) {
        seq.push(val2);
        val2 += i % 2 === 0 ? a : b;
      }
      answer = val2;
      rule = `Alternating +${a}, +${b}`;
      break;
    }
    default: {
      // Squares: n^2
      for (let i = 1; i <= 5; i++) seq.push(i * i);
      answer = 36;
      rule = 'Perfect squares';
      break;
    }
  }

  // For harder difficulties, show fewer numbers
  if (difficulty === 'advanced' || difficulty === 'expert') {
    seq = seq.slice(0, 4);
  }
  if (difficulty === 'master') {
    seq = seq.slice(0, 3);
  }

  return { sequence: seq, answer, rule };
}
