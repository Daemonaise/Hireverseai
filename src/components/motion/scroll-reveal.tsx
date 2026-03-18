'use client';

import { motion } from 'framer-motion';
import { presets, type PresetName } from '@/lib/motion';

interface ScrollRevealProps {
  preset?: PresetName;
  className?: string;
  children: React.ReactNode;
}

export function ScrollReveal({
  preset = 'fadeInUp',
  className,
  children,
}: ScrollRevealProps) {
  const p = presets[preset];

  return (
    <motion.div
      initial={p.initial}
      whileInView={p.animate}
      viewport={{ once: true, margin: '-80px' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
