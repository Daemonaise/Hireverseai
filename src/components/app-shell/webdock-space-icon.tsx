'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type LucideIcon } from 'lucide-react';
import { springTransition } from '@/lib/motion';

interface WebdockSpaceIconProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export function WebdockSpaceIcon({
  icon: Icon,
  label,
  active = false,
  onClick,
}: WebdockSpaceIconProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div className="relative flex items-center justify-center">
      {active && (
        <motion.div
          layoutId="space-active-bar"
          className="absolute left-0 w-[3px] h-5 rounded-r-full bg-primary"
          transition={springTransition}
        />
      )}

      <motion.button
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        whileHover={{ scale: 1.08 }}
        transition={springTransition}
        className={`relative flex items-center justify-center w-9 h-9 rounded-full transition-colors ${
          active
            ? 'bg-primary-glow text-primary'
            : 'text-chrome-foreground/60 hover:bg-chrome-muted hover:text-chrome-foreground'
        }`}
      >
        <Icon className="h-[18px] w-[18px]" />
      </motion.button>

      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, x: 4 }}
            animate={{ opacity: 1, x: 0, transition: { delay: 0.15 } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            className="absolute left-[calc(100%+8px)] z-50 rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background whitespace-nowrap shadow-lg"
          >
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
