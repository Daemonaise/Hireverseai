'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, Github, HardDrive, LayoutGrid, BookOpen, Loader2, ShieldOff, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { listConnections, deleteConnection } from '@/services/hub/connections';
import { listActivityEvents } from '@/services/hub/activity';
import { getProviderConfig } from '@/services/integrations/types';
import type { WorkspaceConnection, NormalizedActivity } from '@/types/hub';
import { Timestamp } from 'firebase/firestore';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageSquare,
  Github,
  HardDrive,
  LayoutGrid,
  BookOpen,
};

function formatDate(ts: Timestamp): string {
  const date = ts instanceof Timestamp ? ts.toDate() : new Date(ts as unknown as string);
  return date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

interface AccessPermissionsProps {
  freelancerId: string;
  workspaceId: string;
}

export function AccessPermissions({ freelancerId, workspaceId }: AccessPermissionsProps) {
  const [connections, setConnections] = useState<WorkspaceConnection[]>([]);
  const [auditEvents, setAuditEvents] = useState<NormalizedActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      listConnections(freelancerId, workspaceId),
      listActivityEvents(freelancerId, workspaceId, { sourceType: 'connection_event' }),
    ]).then(([conns, events]) => {
      setConnections(conns);
      setAuditEvents(events);
      setLoading(false);
    });
  }, [freelancerId, workspaceId]);

  async function handleRevoke(connection: WorkspaceConnection) {
    setRevokingId(connection.id);
    try {
      await deleteConnection(freelancerId, workspaceId, connection.id, connection.provider, connection.label);
      setConnections((prev) => prev.filter((c) => c.id !== connection.id));
      // Refresh audit log
      const events = await listActivityEvents(freelancerId, workspaceId, { sourceType: 'connection_event' });
      setAuditEvents(events);
    } finally {
      setRevokingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <ShieldOff className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">No connected integrations</p>
          <p className="text-xs text-muted-foreground mt-1">
            Connect an integration from the Integrations tab.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        These integrations have access to this workspace. Revoking access removes the
        connection from this workspace only.
      </p>

      {connections.map((connection) => {
        const config = getProviderConfig(connection.provider);
        const IconComponent = ICON_MAP[config.icon] ?? HardDrive;

        const statusVariant =
          connection.status === 'connected'
            ? 'default'
            : connection.status === 'disconnected'
            ? 'secondary'
            : 'destructive';

        const statusLabel =
          connection.status === 'connected'
            ? 'Connected'
            : connection.status === 'disconnected'
            ? 'Disconnected'
            : 'Error';

        return (
          <Card key={connection.id}>
            <CardContent className="flex items-center gap-4 px-4 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gray-50 border">
                <IconComponent className="h-5 w-5 text-foreground" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{connection.label}</span>
                  <Badge variant={statusVariant} className="text-xs">
                    {statusLabel}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {config.name} &middot; Connected since {formatDate(connection.createdAt)}
                </p>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
                    disabled={revokingId === connection.id}
                  >
                    {revokingId === connection.id ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <ShieldOff className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Revoke
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Revoke {config.name} access?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove the {config.name} connection from this workspace.
                      You can reconnect it at any time from the Integrations tab.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => handleRevoke(connection)}
                    >
                      Revoke Access
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        );
      })}

      {/* Connection Audit Log */}
      {auditEvents.length > 0 && (
        <div className="mt-6 space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">Connection Audit Log</h3>
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="max-h-64">
                <ul className="divide-y divide-gray-100">
                  {auditEvents.map((event) => (
                    <li key={event.id} className="flex items-center gap-3 px-4 py-3">
                      <Clock className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      <span className="flex-1 text-sm text-gray-700">{event.title}</span>
                      <time className="text-xs text-gray-400 shrink-0">
                        {formatDate(event.createdAt)}
                      </time>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
