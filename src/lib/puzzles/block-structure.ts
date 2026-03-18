/**
 * 3D block structure generator for spatial reasoning tasks.
 * Generates block positions that form shapes for mental rotation comparison.
 */

import type { DifficultyLevel } from '@/types/assessment';

export interface BlockPosition {
  x: number;
  y: number;
  z: number;
}

export interface SpatialPuzzle {
  structureA: BlockPosition[];
  structureB: BlockPosition[];
  isSame: boolean; // true = same shape rotated, false = mirror/different
  rotationAxis: 'x' | 'y' | 'z';
  rotationDegrees: number;
}

function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

/**
 * Generate a connected block structure by random walk.
 */
function generateStructure(blockCount: number, rng: () => number): BlockPosition[] {
  const blocks: BlockPosition[] = [{ x: 0, y: 0, z: 0 }];
  const occupied = new Set<string>();
  occupied.add('0,0,0');

  const directions = [
    { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 },
    { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 },
  ];

  let attempts = 0;
  while (blocks.length < blockCount && attempts < 100) {
    // Pick a random existing block and grow from it
    const base = blocks[Math.floor(rng() * blocks.length)];
    const dir = directions[Math.floor(rng() * directions.length)];
    const newPos = { x: base.x + dir.x, y: base.y + dir.y, z: base.z + dir.z };
    const key = `${newPos.x},${newPos.y},${newPos.z}`;

    if (!occupied.has(key)) {
      blocks.push(newPos);
      occupied.add(key);
    }
    attempts++;
  }

  return blocks;
}

/**
 * Rotate a structure around an axis.
 */
function rotateStructure(
  blocks: BlockPosition[],
  axis: 'x' | 'y' | 'z',
  degrees: number
): BlockPosition[] {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.round(Math.cos(rad));
  const sin = Math.round(Math.sin(rad));

  return blocks.map((b) => {
    switch (axis) {
      case 'x': return { x: b.x, y: b.y * cos - b.z * sin, z: b.y * sin + b.z * cos };
      case 'y': return { x: b.x * cos + b.z * sin, y: b.y, z: -b.x * sin + b.z * cos };
      case 'z': return { x: b.x * cos - b.y * sin, y: b.x * sin + b.y * cos, z: b.z };
    }
  });
}

/**
 * Mirror a structure along an axis (creates a different shape).
 */
function mirrorStructure(blocks: BlockPosition[], axis: 'x' | 'y' | 'z'): BlockPosition[] {
  return blocks.map((b) => {
    const mirrored = { ...b };
    mirrored[axis] = -mirrored[axis];
    return mirrored;
  });
}

/**
 * Generate a spatial reasoning puzzle.
 */
export function generateSpatialPuzzle(seed: number, difficulty: DifficultyLevel): SpatialPuzzle {
  const rng = seededRng(seed);

  const blockCount = {
    beginner: 3,
    intermediate: 5,
    advanced: 7,
    expert: 9,
    master: 11,
  }[difficulty];

  const structureA = generateStructure(blockCount, rng);

  const axes: Array<'x' | 'y' | 'z'> = ['x', 'y', 'z'];
  const rotationAxis = axes[Math.floor(rng() * axes.length)];

  // Rotation amount based on difficulty
  const rotationOptions = {
    beginner: [90],
    intermediate: [90, 180],
    advanced: [90, 180, 270],
    expert: [45, 90, 135, 180],
    master: [30, 60, 90, 120, 150, 180],
  }[difficulty];
  const rotationDegrees = rotationOptions[Math.floor(rng() * rotationOptions.length)];

  // 50% chance same (rotated), 50% chance different (mirrored)
  const isSame = rng() > 0.5;

  let structureB: BlockPosition[];
  if (isSame) {
    structureB = rotateStructure(structureA, rotationAxis, rotationDegrees);
  } else {
    // Mirror then rotate (creates a subtly different structure)
    const mirrored = mirrorStructure(structureA, axes[Math.floor(rng() * axes.length)]);
    structureB = rotateStructure(mirrored, rotationAxis, rotationDegrees);
  }

  return {
    structureA,
    structureB,
    isSame,
    rotationAxis,
    rotationDegrees,
  };
}
