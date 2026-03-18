'use client';

import { motion } from 'framer-motion';
import { presets, type PresetName } from '@/lib/motion';

interface MotionDivProps {
  preset?: PresetName;
  delay?: number;
  className?: string;
  children: React.ReactNode;
}

export function MotionDiv({
  preset = 'fadeInUp',
  delay,
  className,
  children,
}: MotionDivProps) {
  const p = presets[preset];
  const animate = delay
    ? { ...p.animate, transition: { ...(p.animate as any).transition, delay } }
    : p.animate;

  return (
    <motion.div initial={p.initial} animate={animate} className={className}>
      {children}
    </motion.div>
  );
}
