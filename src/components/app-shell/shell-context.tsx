'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import type { TabDef } from './toolbar-tabstrip';

interface ShellContextValue {
  title: string;
  setTitle: (title: string) => void;
  tabs: TabDef[];
  setTabs: (tabs: TabDef[]) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = useState('');
  const [tabs, setTabs] = useState<TabDef[]>([]);
  const [activeTab, setActiveTab] = useState('');

  return (
    <ShellContext.Provider
      value={{ title, setTitle, tabs, setTabs, activeTab, setActiveTab }}
    >
      {children}
    </ShellContext.Provider>
  );
}

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell must be used within ShellProvider');
  return ctx;
}
