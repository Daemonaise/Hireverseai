'use client';

import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MotionDiv } from '@/components/motion/motion-div';
import type { BlockPosition } from '@/lib/puzzles/block-structure';

interface SpatialViewerProps {
  structureA: BlockPosition[];
  structureB: BlockPosition[];
  isSame: boolean;
  questionNumber: number;
  difficulty: string;
  onSubmit: (answeredSame: boolean, isCorrect: boolean) => void;
  submitting?: boolean;
}

function BlockStructure({ blocks, color }: { blocks: BlockPosition[]; color: string }) {
  return (
    <group>
      {blocks.map((block, i) => (
        <mesh key={i} position={[block.x, block.y, block.z]}>
          <boxGeometry args={[0.9, 0.9, 0.9]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}

function Scene({ blocks, color }: { blocks: BlockPosition[]; color: string }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <BlockStructure blocks={blocks} color={color} />
    </>
  );
}

export function SpatialViewer({
  structureA,
  structureB,
  isSame,
  questionNumber,
  difficulty,
  onSubmit,
  submitting,
}: SpatialViewerProps) {
  const [answer, setAnswer] = useState<'same' | 'different' | null>(null);

  function handleSubmit() {
    if (!answer || submitting) return;
    const answeredSame = answer === 'same';
    onSubmit(answeredSame, answeredSame === isSame);
  }

  return (
    <MotionDiv preset="fadeInUp" className="space-y-6">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">Q{questionNumber}</Badge>
        <Badge variant="secondary" className="text-xs">Spatial Reasoning</Badge>
        <Badge className="text-xs capitalize bg-primary text-white">{difficulty}</Badge>
      </div>

      <p className="text-sm text-muted-foreground">
        Are these two 3D structures the same shape (just rotated), or are they different shapes?
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <p className="text-xs font-medium text-center py-2 bg-muted">Structure A</p>
          <div className="h-[250px]">
            <Canvas camera={{ position: [4, 4, 4], fov: 50 }}>
              <Scene blocks={structureA} color="#03b9ff" />
            </Canvas>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <p className="text-xs font-medium text-center py-2 bg-muted">Structure B</p>
          <div className="h-[250px]">
            <Canvas camera={{ position: [4, 4, 4], fov: 50 }}>
              <Scene blocks={structureB} color="#03b9ff" />
            </Canvas>
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-4">
        <Button
          variant={answer === 'same' ? 'default' : 'outline'}
          onClick={() => setAnswer('same')}
          className="w-40"
        >
          Same Shape
        </Button>
        <Button
          variant={answer === 'different' ? 'default' : 'outline'}
          onClick={() => setAnswer('different')}
          className="w-40"
        >
          Different Shape
        </Button>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={!answer || submitting}>
          Submit Answer
        </Button>
      </div>
    </MotionDiv>
  );
}
