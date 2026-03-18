'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useWorkspace } from '@/hooks/hub/use-workspace';
import { useConnections, useConnectionMutations } from '@/hooks/hub/use-connections';
import { useShell } from '@/components/app-shell/shell-context';
import { TabTransition } from '@/components/motion/tab-transition';
import { PageTransition } from '@/components/motion/page-transition';
import { SkeletonTabs } from '@/components/ui/skeleton-tabs';
import { updateLastVisitedAt } from '@/services/hub/workspaces';
import type { Workspace } from '@/types/hub';
import { BookmarkList } from '@/components/hub/bookmark-list';
import { ConnectionTile } from '@/components/hub/connection-tile';
import { ConnectionSetupDialog } from '@/components/hub/connection-setup-dialog';
import { NoteEditor } from '@/components/hub/note-editor';
import { AccessPermissions } from '@/components/hub/access-permissions';
import { ActivityTimeline } from '@/components/hub/activity-timeline';
import { AiBriefingPanel } from '@/components/hub/ai-briefing-panel';
import { WorkspaceChat } from '@/components/hub/workspace-chat';
import { WorkspaceMessages } from '@/components/hub/workspace-messages';

interface WorkspaceDetailProps {
  freelancerId: string;
  workspaceId: string;
}

function statusVariant(status: Workspace['status']): 'default' | 'secondary' | 'outline' {
  switch (status) {
    case 'active': return 'default';
    case 'archived': return 'secondary';
    default: return 'outline';
  }
}

function formatDate(ts: Workspace['createdAt']): string {
  if (!ts) return '—';
  const date = typeof (ts as { toDate?: () => Date }).toDate === 'function'
    ? (ts as { toDate: () => Date }).toDate()
    : new Date(ts as unknown as string);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

const WORKSPACE_TABS = [
  { id: 'overview', labelKey: 'overview' },
  { id: 'apps', labelKey: 'apps' },
  { id: 'notes', labelKey: 'notes' },
  { id: 'tasks', labelKey: 'tasks' },
  { id: 'app-messages', labelKey: 'appMessages' },
  { id: 'messages', labelKey: 'messages' },
  { id: 'files', labelKey: 'files' },
  { id: 'timeline', labelKey: 'timeline' },
  { id: 'ai-briefing', labelKey: 'aiBriefing' },
  { id: 'access', labelKey: 'accessPermissions' },
];

export function WorkspaceDetail({ freelancerId, workspaceId }: WorkspaceDetailProps) {
  const { data: workspace, isLoading: loading } = useWorkspace(freelancerId, workspaceId);
  const { data: connections = [] } = useConnections(freelancerId, workspaceId);
  const { remove: removeConnection } = useConnectionMutations(freelancerId, workspaceId);
  const t = useTranslations('hub');
  const shell = useShell();

  const [setupDialogOpen, setSetupDialogOpen] = useState(false);

  // Register tabs in the toolbar via shell context
  useEffect(() => {
    const tabs = WORKSPACE_TABS.map((tab) => ({
      id: tab.id,
      label: t(tab.labelKey),
    }));
    shell.setTabs(tabs);
    if (!shell.activeTab) shell.setActiveTab('overview');
    return () => {
      shell.setTabs([]);
      shell.setActiveTab('');
      shell.setTitle('');
    };
  }, [t]); // eslint-disable-line react-hooks/exhaustive-deps

  // Set toolbar title to workspace name
  useEffect(() => {
    if (workspace?.name) shell.setTitle(workspace.name);
  }, [workspace?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    updateLastVisitedAt(freelancerId, workspaceId).catch(() => {});
  }, [freelancerId, workspaceId]);

  async function handleDeleteConnection(connectionId: string) {
    const conn = connections.find((c) => c.id === connectionId);
    await removeConnection.mutateAsync({
      connectionId,
      provider: conn?.provider,
      label: conn?.label,
    });
  }

  if (loading) {
    return <SkeletonTabs tabs={6} className="max-w-6xl mx-auto" />;
  }

  if (!workspace) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg font-medium">{t('workspaceNotFound')}</p>
        <Link href="/freelancer/hub" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          {t('backToHub')}
        </Link>
      </div>
    );
  }

  const existingProviders = connections.map((c) => c.provider);
  const activeTab = shell.activeTab || 'overview';

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto">
        <TabTransition activeKey={activeTab}>
          {activeTab === 'overview' && (
            <div className="space-y-8">
              <div className="rounded-lg border border-border bg-card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Workspace Info
                  </h2>
                  <Badge variant={statusVariant(workspace.status)} className="capitalize">
                    {workspace.status}
                  </Badge>
                </div>
                <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Name</dt>
                    <dd className="mt-0.5 text-sm">{workspace.name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Client</dt>
                    <dd className="mt-0.5 text-sm">{workspace.clientName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Engagement</dt>
                    <dd className="mt-0.5 text-sm capitalize">{workspace.engagementType}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Created</dt>
                    <dd className="mt-0.5 text-sm">{formatDate(workspace.createdAt)}</dd>
                  </div>
                </dl>
              </div>
              <div>
                <h2 className="mb-4 text-base font-semibold">Bookmarks</h2>
                <BookmarkList freelancerId={freelancerId} workspaceId={workspaceId} />
              </div>
            </div>
          )}

          {activeTab === 'apps' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Connected Apps</h2>
                <Button onClick={() => setSetupDialogOpen(true)}>Add Connection</Button>
              </div>
              {connections.length === 0 ? (
                <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border">
                  <p className="text-sm text-muted-foreground">No integrations connected yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {connections.map((connection) => (
                    <ConnectionTile
                      key={connection.id}
                      connection={connection}
                      onDelete={() => handleDeleteConnection(connection.id)}
                    />
                  ))}
                </div>
              )}
              <ConnectionSetupDialog
                open={setupDialogOpen}
                onOpenChange={setSetupDialogOpen}
                freelancerId={freelancerId}
                workspaceId={workspaceId}
                existingProviders={existingProviders}
                onConnectionCreated={() => setSetupDialogOpen(false)}
              />
            </div>
          )}

          {activeTab === 'notes' && (
            <NoteEditor freelancerId={freelancerId} workspaceId={workspaceId} />
          )}

          {activeTab === 'tasks' && (
            <ActivityTimeline freelancerId={freelancerId} workspaceId={workspaceId} filterSourceType={['task', 'ticket']} />
          )}

          {activeTab === 'app-messages' && (
            <ActivityTimeline freelancerId={freelancerId} workspaceId={workspaceId} filterSourceType="message" />
          )}

          {activeTab === 'messages' && (
            <WorkspaceMessages freelancerId={freelancerId} workspaceId={workspaceId} />
          )}

          {activeTab === 'files' && (
            <ActivityTimeline freelancerId={freelancerId} workspaceId={workspaceId} filterSourceType="document" />
          )}

          {activeTab === 'timeline' && (
            <ActivityTimeline freelancerId={freelancerId} workspaceId={workspaceId} />
          )}

          {activeTab === 'ai-briefing' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <AiBriefingPanel freelancerId={freelancerId} workspaceId={workspaceId} />
              <WorkspaceChat freelancerId={freelancerId} workspaceId={workspaceId} />
            </div>
          )}

          {activeTab === 'access' && (
            <AccessPermissions freelancerId={freelancerId} workspaceId={workspaceId} />
          )}
        </TabTransition>
      </div>
    </PageTransition>
  );
}
