'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, Github, HardDrive, LayoutGrid, BookOpen, Loader2, ShieldOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { getProviderConfig } from '@/services/integrations/types';
import type { WorkspaceConnection } from '@/types/hub';
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
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    listConnections(freelancerId, workspaceId).then((data) => {
      setConnections(data);
      setLoading(false);
    });
  }, [freelancerId, workspaceId]);

  async function handleRevoke(connectionId: string) {
    setRevokingId(connectionId);
    try {
      await deleteConnection(freelancerId, workspaceId, connectionId);
      setConnections((prev) => prev.filter((c) => c.id !== connectionId));
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
                      onClick={() => handleRevoke(connection.id)}
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
    </div>
  );
}
