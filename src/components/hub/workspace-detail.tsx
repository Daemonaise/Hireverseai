'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getWorkspace, updateLastVisitedAt } from '@/services/hub/workspaces';
import { listConnections, deleteConnection } from '@/services/hub/connections';
import type { Workspace, WorkspaceConnection } from '@/types/hub';
import { BookmarkList } from '@/components/hub/bookmark-list';
import { ConnectionTile } from '@/components/hub/connection-tile';
import { ConnectionSetupDialog } from '@/components/hub/connection-setup-dialog';
import { NoteEditor } from '@/components/hub/note-editor';
import { AccessPermissions } from '@/components/hub/access-permissions';
import { ActivityTimeline } from '@/components/hub/activity-timeline';
import { AIBriefingPanel } from '@/components/hub/ai-briefing-panel';
import { WorkspaceChat } from '@/components/hub/workspace-chat';

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
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [connections, setConnections] = useState<WorkspaceConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ws, conns] = await Promise.all([
        getWorkspace(freelancerId, workspaceId),
        listConnections(freelancerId, workspaceId),
      ]);
      setWorkspace(ws);
      setConnections(conns);
    } finally {
      setLoading(false);
    }
  }, [freelancerId, workspaceId]);

  useEffect(() => {
    fetchData();
    updateLastVisitedAt(freelancerId, workspaceId).catch(() => {});
  }, [fetchData, freelancerId, workspaceId]);

  const handleDeleteConnection = useCallback(
    async (connectionId: string) => {
      await deleteConnection(freelancerId, workspaceId, connectionId);
      setConnections((prev) => prev.filter((c) => c.id !== connectionId));
    },
    [freelancerId, workspaceId]
  );

  const handleConnectionCreated = useCallback(() => {
    setSetupDialogOpen(false);
    fetchData();
  }, [fetchData]);

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
        <p className="text-lg font-medium text-gray-900">Workspace not found</p>
        <p className="text-sm text-gray-500">
          This workspace may have been deleted or you may not have access.
        </p>
        <Link href="/freelancer/hub" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          Back to Hub
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
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="apps">Apps</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="ai-briefing">AI Briefing</TabsTrigger>
          <TabsTrigger value="access">Access &amp; Permissions</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-8">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Workspace Info
            </h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-gray-500">Name</dt>
                <dd className="mt-0.5 text-sm text-gray-900">{workspace.name}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">Client</dt>
                <dd className="mt-0.5 text-sm text-gray-900">{workspace.clientName}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">Engagement Type</dt>
                <dd className="mt-0.5 text-sm capitalize text-gray-900">
                  {workspace.engagementType}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">Status</dt>
                <dd className="mt-0.5">
                  <Badge variant={statusVariant(workspace.status)} className="capitalize">
                    {workspace.status}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">Created</dt>
                <dd className="mt-0.5 text-sm text-gray-900">{formatDate(workspace.createdAt)}</dd>
              </div>
            </dl>
          </div>

          <div>
            <h2 className="mb-4 text-base font-semibold text-gray-900">Bookmarks</h2>
            <BookmarkList freelancerId={freelancerId} workspaceId={workspaceId} />
          </div>
        </TabsContent>

        {/* Apps Tab */}
        <TabsContent value="apps" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Connected Apps</h2>
            <Button onClick={() => setSetupDialogOpen(true)}>Add Connection</Button>
          </div>

          {connections.length === 0 ? (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
              <p className="text-sm text-gray-500">No apps connected yet. Add a connection to get started.</p>
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
            onSuccess={handleConnectionCreated}
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

        {/* Messages Tab */}
        <TabsContent value="messages">
          <ActivityTimeline freelancerId={freelancerId} workspaceId={workspaceId} filterSourceType="message" />
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
            <AIBriefingPanel freelancerId={freelancerId} workspaceId={workspaceId} />
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
