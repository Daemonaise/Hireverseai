'use client';

import { Webdock } from './webdock';
import { Toolbar } from './toolbar';
import { ContentArea } from './content-area';
import { ShellProvider, useShell } from './shell-context';
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

function AppShellInner({
  role,
  title: propTitle,
  tabs: propTabs,
  activeTab: propActiveTab,
  onTabChange: propOnTabChange,
  groups,
  onCreateGroup,
  children,
  contentClassName,
}: AppShellProps) {
  const shell = useShell();

  // Context values override prop values (child pages can set their own title/tabs)
  const title = shell.title || propTitle || '';
  const tabs = shell.tabs.length > 0 ? shell.tabs : propTabs;
  const activeTab = shell.activeTab || propActiveTab;
  const onTabChange = shell.tabs.length > 0 ? shell.setActiveTab : propOnTabChange;

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

export function AppShell(props: AppShellProps) {
  return (
    <ShellProvider>
      <AppShellInner {...props} />
    </ShellProvider>
  );
}
