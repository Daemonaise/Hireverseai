'use client';

import { motion } from 'framer-motion';
import { springTransition } from '@/lib/motion';

export interface TabDef {
  id: string;
  label: string;
}

interface ToolbarTabstripProps {
  tabs: TabDef[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function ToolbarTabstrip({
  tabs,
  activeTab,
  onTabChange,
}: ToolbarTabstripProps) {
  return (
    <div className="flex items-center gap-1 h-full">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`relative px-3 h-full text-xs font-medium transition-colors ${
              isActive
                ? 'text-primary'
                : 'text-chrome-foreground/60 hover:text-chrome-foreground'
            }`}
          >
            {tab.label}
            {isActive && (
              <motion.div
                layoutId="active-tab"
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary"
                transition={springTransition}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
