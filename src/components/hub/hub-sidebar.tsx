'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus, Archive, FolderOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useWorkspaces } from '@/hooks/hub/use-workspace';

interface HubSidebarProps {
  freelancerId: string;
}

export function HubSidebar({ freelancerId }: HubSidebarProps) {
  const pathname = usePathname();
  const { data: workspaces = [] } = useWorkspaces(freelancerId);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const t = useTranslations('sidebar');

  const active = workspaces.filter((w) => w.status === 'active');
  const archived = workspaces.filter((w) => w.status === 'archived');

  return (
    <aside className="w-64 border-r bg-white h-full flex flex-col">
      <div className="p-4">
        <Button asChild className="w-full" size="sm">
          <Link href="/freelancer/hub">
            <Plus className="h-4 w-4 mr-2" />
            {t('newWorkspace')}
          </Link>
        </Button>
      </div>

      <Separator />

      <ScrollArea className="flex-1">
        <div className="p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
            Workspaces
          </p>

          {active.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-1">No active workspaces</p>
          )}

          <ul className="space-y-0.5">
            {active.map((workspace) => {
              const href = `/freelancer/hub/${workspace.id}`;
              const isActive = pathname === href;
              return (
                <li key={workspace.id}>
                  <Link
                    href={href}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-foreground hover:bg-gray-100'
                    }`}
                  >
                    <FolderOpen className="h-4 w-4 shrink-0" />
                    <span className="truncate">{workspace.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {archived.length > 0 && (
            <div className="mt-4">
              <Separator className="mb-3" />
              <button
                onClick={() => setArchivedOpen((prev) => !prev)}
                className="flex items-center gap-2 w-full text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2 hover:text-foreground transition-colors"
              >
                <Archive className="h-3.5 w-3.5" />
                {t('archived')}
                <span className="ml-auto">{archivedOpen ? '−' : '+'}</span>
              </button>

              {archivedOpen && (
                <ul className="space-y-0.5">
                  {archived.map((workspace) => {
                    const href = `/freelancer/hub/${workspace.id}`;
                    const isActive = pathname === href;
                    return (
                      <li key={workspace.id}>
                        <Link
                          href={href}
                          className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                            isActive
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'text-muted-foreground hover:bg-gray-100 hover:text-foreground'
                          }`}
                        >
                          <FolderOpen className="h-4 w-4 shrink-0 opacity-60" />
                          <span className="truncate">{workspace.name}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
