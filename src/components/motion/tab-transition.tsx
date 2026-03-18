'use client';

import { AnimatePresence, motion } from 'framer-motion';

interface TabTransitionProps {
  activeKey: string;
  className?: string;
  children: React.ReactNode;
}

export function TabTransition({
  activeKey,
  className,
  children,
}: TabTransitionProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeKey}
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0, transition: { duration: 0.25 } }}
        exit={{ opacity: 0, x: -8, transition: { duration: 0.15 } }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
