'use client';

import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/motion';

interface PageTransitionProps {
  className?: string;
  children: React.ReactNode;
}

export function PageTransition({ className, children }: PageTransitionProps) {
  return (
    <motion.div
      initial={fadeInUp.initial}
      animate={fadeInUp.animate}
      className={className}
    >
      {children}
    </motion.div>
  );
}
