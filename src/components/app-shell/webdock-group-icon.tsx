'use client';

import { motion } from 'framer-motion';
import { springTransition } from '@/lib/motion';

interface WebdockGroupIconProps {
  label: string;
  active?: boolean;
  unreadCount?: number;
  onClick?: () => void;
}

export function WebdockGroupIcon({
  label,
  active = false,
  unreadCount = 0,
  onClick,
}: WebdockGroupIconProps) {
  const initials = label
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.08 }}
      transition={springTransition}
      className={`relative flex items-center justify-center w-10 h-10 rounded-lg text-xs font-semibold transition-colors ${
        active
          ? 'ring-2 ring-primary bg-chrome-muted text-primary'
          : 'bg-chrome-muted/60 text-chrome-foreground/70 hover:bg-chrome-muted hover:text-chrome-foreground'
      }`}
      title={label}
    >
      {initials}

      {unreadCount > 0 && (
        <motion.div
          key={unreadCount}
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 rounded-full bg-unread px-1"
        >
          <span className="text-[10px] font-bold text-white leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        </motion.div>
      )}
    </motion.button>
  );
}
