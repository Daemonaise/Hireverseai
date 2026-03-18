/**
 * Procedural Raven's-style matrix puzzle generator.
 * Generates a 3x3 grid of SVG shapes with transformation rules.
 * The 9th cell is the answer — 6 options generated (1 correct, 5 distractors).
 */

import type { DifficultyLevel } from '@/types/assessment';

// --- Shape primitives ---

type ShapeType = 'circle' | 'square' | 'triangle' | 'diamond' | 'star' | 'hexagon';
type Color = string;

interface CellState {
  shape: ShapeType;
  color: Color;
  size: number; // 0.5 - 1.5 scale
  rotation: number; // degrees
  count: number; // number of shapes in cell (1-3)
}

interface MatrixPuzzle {
  grid: CellState[][]; // 3x3 (last cell is the answer)
  options: CellState[]; // 6 answer options
  correctIndex: number;
  svgGrid: string; // Full SVG for the 3x3 grid (9th cell blank)
  svgOptions: string[]; // 6 SVG strings for answer options
}

// --- Seeded RNG ---

function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// --- Constants ---

const SHAPES: ShapeType[] = ['circle', 'square', 'triangle', 'diamond', 'star', 'hexagon'];
const COLORS = ['#03b9ff', '#ff6b6b', '#51cf66', '#ffd43b', '#845ef7', '#ff922b'];
const SIZES = [0.6, 0.8, 1.0, 1.2, 1.4];
const ROTATIONS = [0, 45, 90, 135, 180, 225, 270, 315];

// --- Shape SVG renderers ---

function renderShape(shape: ShapeType, cx: number, cy: number, size: number, color: string, rotation: number): string {
  const r = 16 * size;
  const transform = rotation !== 0 ? ` transform="rotate(${rotation} ${cx} ${cy})"` : '';

  switch (shape) {
    case 'circle':
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"${transform}/>`;
    case 'square':
      return `<rect x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" fill="${color}"${transform}/>`;
    case 'triangle': {
      const pts = `${cx},${cy - r} ${cx - r},${cy + r} ${cx + r},${cy + r}`;
      return `<polygon points="${pts}" fill="${color}"${transform}/>`;
    }
    case 'diamond': {
      const pts = `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`;
      return `<polygon points="${pts}" fill="${color}"${transform}/>`;
    }
    case 'star': {
      const inner = r * 0.4;
      let pts = '';
      for (let i = 0; i < 5; i++) {
        const outerAngle = (i * 72 - 90) * Math.PI / 180;
        const innerAngle = ((i * 72 + 36) - 90) * Math.PI / 180;
        pts += `${cx + r * Math.cos(outerAngle)},${cy + r * Math.sin(outerAngle)} `;
        pts += `${cx + inner * Math.cos(innerAngle)},${cy + inner * Math.sin(innerAngle)} `;
      }
      return `<polygon points="${pts.trim()}" fill="${color}"${transform}/>`;
    }
    case 'hexagon': {
      let pts = '';
      for (let i = 0; i < 6; i++) {
        const angle = (i * 60 - 30) * Math.PI / 180;
        pts += `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)} `;
      }
      return `<polygon points="${pts.trim()}" fill="${color}"${transform}/>`;
    }
  }
}

function renderCell(state: CellState, cx: number, cy: number): string {
  let svg = '';
  if (state.count === 1) {
    svg = renderShape(state.shape, cx, cy, state.size, state.color, state.rotation);
  } else {
    const offset = 12;
    for (let i = 0; i < state.count; i++) {
      const ox = cx + (i - (state.count - 1) / 2) * offset;
      svg += renderShape(state.shape, ox, cy, state.size * 0.7, state.color, state.rotation);
    }
  }
  return svg;
}

// --- Rule system ---

type Rule = (row: number, col: number, rng: () => number) => Partial<CellState>;

function makeRules(difficulty: DifficultyLevel, rng: () => number): Rule[] {
  const numRules = {
    beginner: 1,
    intermediate: 2,
    advanced: 3,
    expert: 3,
    master: 4,
  }[difficulty];

  const allRules: Rule[] = [
    // Shape changes per row
    (row) => ({ shape: SHAPES[row % SHAPES.length] }),
    // Color changes per column
    (_row, col) => ({ color: COLORS[col % COLORS.length] }),
    // Size increases per column
    (_row, col) => ({ size: SIZES[col % SIZES.length] }),
    // Rotation increases per row
    (row) => ({ rotation: ROTATIONS[(row * 2) % ROTATIONS.length] }),
    // Count increases per column
    (_row, col) => ({ count: col + 1 }),
    // Shape changes per column
    (_row, col) => ({ shape: SHAPES[(col + 2) % SHAPES.length] }),
    // Color changes per row
    (row) => ({ color: COLORS[(row + 1) % COLORS.length] }),
  ];

  // Shuffle and pick
  const shuffled = [...allRules].sort(() => rng() - 0.5);
  return shuffled.slice(0, numRules);
}

// --- Generator ---

export function generateMatrixPuzzle(seed: number, difficulty: DifficultyLevel): MatrixPuzzle {
  const rng = seededRng(seed);
  const rules = makeRules(difficulty, rng);

  // Base state
  const baseShape = SHAPES[Math.floor(rng() * SHAPES.length)];
  const baseColor = COLORS[Math.floor(rng() * COLORS.length)];

  // Generate 3x3 grid
  const grid: CellState[][] = [];
  for (let row = 0; row < 3; row++) {
    const rowCells: CellState[] = [];
    for (let col = 0; col < 3; col++) {
      const cell: CellState = {
        shape: baseShape,
        color: baseColor,
        size: 1.0,
        rotation: 0,
        count: 1,
      };

      // Apply rules
      for (const rule of rules) {
        Object.assign(cell, rule(row, col, rng));
      }

      rowCells.push(cell);
    }
    grid.push(rowCells);
  }

  // The correct answer is grid[2][2]
  const correctAnswer = { ...grid[2][2] };

  // Generate distractors
  const options: CellState[] = [];
  options.push(correctAnswer);

  for (let i = 0; i < 5; i++) {
    const distractor = { ...correctAnswer };
    // Mutate 1-2 properties
    const mutations = Math.floor(rng() * 2) + 1;
    for (let m = 0; m < mutations; m++) {
      const prop = Math.floor(rng() * 4);
      switch (prop) {
        case 0: distractor.shape = SHAPES[Math.floor(rng() * SHAPES.length)]; break;
        case 1: distractor.color = COLORS[Math.floor(rng() * COLORS.length)]; break;
        case 2: distractor.size = SIZES[Math.floor(rng() * SIZES.length)]; break;
        case 3: distractor.rotation = ROTATIONS[Math.floor(rng() * ROTATIONS.length)]; break;
      }
    }
    // Make sure distractor differs from correct
    if (JSON.stringify(distractor) === JSON.stringify(correctAnswer)) {
      distractor.shape = SHAPES[(SHAPES.indexOf(distractor.shape) + 1) % SHAPES.length];
    }
    options.push(distractor);
  }

  // Shuffle options, track correct index
  const shuffledOptions: CellState[] = [];
  const indices = [0, 1, 2, 3, 4, 5].sort(() => rng() - 0.5);
  for (const idx of indices) shuffledOptions.push(options[idx]);
  const correctIndex = indices.indexOf(0);

  // Render SVGs
  const cellSize = 80;
  const gap = 8;
  const gridWidth = cellSize * 3 + gap * 2;

  let gridSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${gridWidth} ${gridWidth}" width="${gridWidth}" height="${gridWidth}">`;
  gridSvg += `<rect width="${gridWidth}" height="${gridWidth}" fill="none"/>`;

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const x = col * (cellSize + gap);
      const y = row * (cellSize + gap);
      const cx = x + cellSize / 2;
      const cy = y + cellSize / 2;

      // Cell background
      gridSvg += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="6" fill="#f8f9fa" stroke="#dee2e6" stroke-width="1.5"/>`;

      // Skip last cell (the answer)
      if (row === 2 && col === 2) {
        gridSvg += `<text x="${cx}" y="${cy + 6}" text-anchor="middle" font-size="24" fill="#adb5bd">?</text>`;
      } else {
        gridSvg += renderCell(grid[row][col], cx, cy);
      }
    }
  }
  gridSvg += '</svg>';

  // Render option SVGs
  const svgOptions = shuffledOptions.map((opt) => {
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cellSize} ${cellSize}" width="${cellSize}" height="${cellSize}">`;
    svg += `<rect width="${cellSize}" height="${cellSize}" rx="6" fill="#f8f9fa" stroke="#dee2e6" stroke-width="1.5"/>`;
    svg += renderCell(opt, cellSize / 2, cellSize / 2);
    svg += '</svg>';
    return svg;
  });

  return {
    grid,
    options: shuffledOptions,
    correctIndex,
    svgGrid: gridSvg,
    svgOptions,
  };
}
