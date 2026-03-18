'use client';

import { Webdock } from './webdock';
import { Toolbar } from './toolbar';
import { ContentArea } from './content-area';
import type { TabDef } from './toolbar-tabstrip';

interface AppShellProps {
  role: 'freelancer' | 'client';
  title?: string;
  tabs?: TabDef[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  groups?: Array<{
    id: string;
    label: string;
    unreadCount?: number;
    href: string;
  }>;
  onCreateGroup?: () => void;
  children: React.ReactNode;
  contentClassName?: string;
}

export function AppShell({
  role,
  title = '',
  tabs,
  activeTab,
  onTabChange,
  groups,
  onCreateGroup,
  children,
  contentClassName,
}: AppShellProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Webdock role={role} groups={groups} onCreateGroup={onCreateGroup} />
      <div className="flex flex-col flex-1 min-w-0">
        <Toolbar
          title={title}
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
        />
        <ContentArea className={contentClassName}>{children}</ContentArea>
      </div>
    </div>
  );
}
