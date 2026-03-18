'use client';

import { useState } from 'react';
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
import { useConnections, useConnectionMutations } from '@/hooks/hub/use-connections';
import { useActivityEvents } from '@/hooks/hub/use-activity';
import { useTranslations } from 'next-intl';
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
  const { data: connections = [], isLoading: loading } = useConnections(freelancerId, workspaceId);
  const { data: auditEvents = [] } = useActivityEvents(freelancerId, workspaceId, { sourceType: 'connection_event' });
  const { remove } = useConnectionMutations(freelancerId, workspaceId);
  const t = useTranslations('permissions');

  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function handleRevoke(connection: WorkspaceConnection) {
    setRevokingId(connection.id);
    try {
      await remove.mutateAsync({
        connectionId: connection.id,
        provider: connection.provider,
        label: connection.label,
      });
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
          <p className="text-sm font-medium">{t('noConnectedIntegrations')}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {t('connectFromIntegrationsTab')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {t('integrationsDescription')}
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
            ? t('connected')
            : connection.status === 'disconnected'
            ? t('disconnected')
            : t('error');

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
                  {config.name} &middot; {t('connectedSince')} {formatDate(connection.createdAt)}
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
                    {t('revoke')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('revokeAccessTitle', { provider: config.name })}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('revokeAccessDescription', { provider: config.name })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => handleRevoke(connection)}
                    >
                      {t('revokeAccess')}
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
          <h3 className="text-sm font-semibold text-gray-700">{t('connectionAuditLog')}</h3>
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
