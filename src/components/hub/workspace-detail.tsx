'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useWorkspace } from '@/hooks/hub/use-workspace';
import { useConnections, useConnectionMutations } from '@/hooks/hub/use-connections';
import { useTranslations } from 'next-intl';
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
    case 'active':
      return 'default';
    case 'archived':
      return 'secondary';
    default:
      return 'outline';
  }
}

function formatDate(ts: Workspace['createdAt']): string {
  if (!ts) return '—';
  // Firestore Timestamp has .toDate()
  const date = typeof (ts as { toDate?: () => Date }).toDate === 'function'
    ? (ts as { toDate: () => Date }).toDate()
    : new Date(ts as unknown as string);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function WorkspaceDetail({ freelancerId, workspaceId }: WorkspaceDetailProps) {
  const { data: workspace, isLoading: loading } = useWorkspace(freelancerId, workspaceId);
  const { data: connections = [] } = useConnections(freelancerId, workspaceId);
  const { remove: removeConnection } = useConnectionMutations(freelancerId, workspaceId);
  const t = useTranslations('hub');

  const [setupDialogOpen, setSetupDialogOpen] = useState(false);

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

  function handleConnectionCreated() {
    setSetupDialogOpen(false);
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg font-medium text-gray-900">{t('workspaceNotFound')}</p>
        <p className="text-sm text-gray-500">
          {t('workspaceNotFoundDescription')}
        </p>
        <Link href="/freelancer/hub" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          {t('backToHub')}
        </Link>
      </div>
    );
  }

  const existingProviders = connections.map((c) => c.provider);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900">{workspace.name}</h1>
            <Badge variant={statusVariant(workspace.status)} className="capitalize">
              {workspace.status}
            </Badge>
          </div>
          <p className="text-sm text-gray-500">{workspace.clientName}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">{t('overview')}</TabsTrigger>
          <TabsTrigger value="apps">{t('apps')}</TabsTrigger>
          <TabsTrigger value="notes">{t('notes')}</TabsTrigger>
          <TabsTrigger value="tasks">{t('tasks')}</TabsTrigger>
          <TabsTrigger value="app-messages">{t('appMessages')}</TabsTrigger>
          <TabsTrigger value="messages">{t('messages')}</TabsTrigger>
          <TabsTrigger value="files">{t('files')}</TabsTrigger>
          <TabsTrigger value="timeline">{t('timeline')}</TabsTrigger>
          <TabsTrigger value="ai-briefing">{t('aiBriefing')}</TabsTrigger>
          <TabsTrigger value="access">{t('accessPermissions')}</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-8">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
              {t('workspaceInfo')}
            </h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-gray-500">{t('name')}</dt>
                <dd className="mt-0.5 text-sm text-gray-900">{workspace.name}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">{t('client')}</dt>
                <dd className="mt-0.5 text-sm text-gray-900">{workspace.clientName}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">{t('engagementType')}</dt>
                <dd className="mt-0.5 text-sm capitalize text-gray-900">
                  {workspace.engagementType}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">{t('status')}</dt>
                <dd className="mt-0.5">
                  <Badge variant={statusVariant(workspace.status)} className="capitalize">
                    {workspace.status}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">{t('created')}</dt>
                <dd className="mt-0.5 text-sm text-gray-900">{formatDate(workspace.createdAt)}</dd>
              </div>
            </dl>
          </div>

          <div>
            <h2 className="mb-4 text-base font-semibold text-gray-900">{t('bookmarks')}</h2>
            <BookmarkList freelancerId={freelancerId} workspaceId={workspaceId} />
          </div>
        </TabsContent>

        {/* Apps Tab */}
        <TabsContent value="apps" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">{t('connectedApps')}</h2>
            <Button onClick={() => setSetupDialogOpen(true)}>{t('addConnection')}</Button>
          </div>

          {connections.length === 0 ? (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
              <p className="text-sm text-gray-500">{t('noAppsConnected')}</p>
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
            onConnectionCreated={handleConnectionCreated}
          />
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes">
          <NoteEditor freelancerId={freelancerId} workspaceId={workspaceId} />
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks">
          <ActivityTimeline freelancerId={freelancerId} workspaceId={workspaceId} filterSourceType={['task', 'ticket']} />
        </TabsContent>

        {/* App Messages Tab */}
        <TabsContent value="app-messages">
          <ActivityTimeline freelancerId={freelancerId} workspaceId={workspaceId} filterSourceType="message" />
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages">
          <WorkspaceMessages freelancerId={freelancerId} workspaceId={workspaceId} />
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files">
          <ActivityTimeline freelancerId={freelancerId} workspaceId={workspaceId} filterSourceType="document" />
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline">
          <ActivityTimeline freelancerId={freelancerId} workspaceId={workspaceId} />
        </TabsContent>

        {/* AI Briefing Tab */}
        <TabsContent value="ai-briefing">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <AiBriefingPanel freelancerId={freelancerId} workspaceId={workspaceId} />
            <WorkspaceChat freelancerId={freelancerId} workspaceId={workspaceId} />
          </div>
        </TabsContent>

        {/* Access & Permissions Tab */}
        <TabsContent value="access">
          <AccessPermissions freelancerId={freelancerId} workspaceId={workspaceId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
