'use client';

import { useState } from 'react';
import { MessageSquare, Github, HardDrive, LayoutGrid, BookOpen, ExternalLink, Unplug } from 'lucide-react';
import type { WorkspaceConnection } from '@/types/hub';
import { getProviderConfig } from '@/services/integrations/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';
import { Timestamp } from 'firebase/firestore';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageSquare,
  Github,
  HardDrive,
  LayoutGrid,
  BookOpen,
};

function formatLastSync(ts: Timestamp | null): string {
  if (!ts) return 'Never synced';
  const date = ts instanceof Timestamp ? ts.toDate() : new Date(ts as unknown as string);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

interface ConnectionTileProps {
  connection: WorkspaceConnection;
  onDelete: (connectionId: string) => void;
}

export function ConnectionTile({ connection, onDelete }: ConnectionTileProps) {
  const [confirming, setConfirming] = useState(false);
  const config = getProviderConfig(connection.provider);
  const IconComponent = ICON_MAP[config.icon] ?? HardDrive;
  const t = useTranslations('connections');

  const statusDot =
    connection.status === 'connected'
      ? 'bg-green-500'
      : connection.status === 'disconnected'
      ? 'bg-yellow-400'
      : 'bg-red-500';

  const statusLabel =
    connection.status === 'connected'
      ? t('connected')
      : connection.status === 'disconnected'
      ? t('disconnected')
      : t('error');

  const statusVariant =
    connection.status === 'connected'
      ? 'default'
      : connection.status === 'disconnected'
      ? 'secondary'
      : 'destructive';

  function handleDisconnect() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    onDelete(connection.id);
    setConfirming(false);
  }

  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border bg-white">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gray-50 border">
        <IconComponent className="h-5 w-5 text-foreground" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{connection.label}</span>
          <span className={`h-2 w-2 rounded-full shrink-0 ${statusDot}`} />
          <Badge variant={statusVariant} className="text-xs">
            {statusLabel}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t('lastSynced')}: {formatLastSync(connection.lastSyncAt)}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          asChild
        >
          <a href={connection.launchUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            {t('launch')}
          </a>
        </Button>

        {confirming ? (
          <div className="flex items-center gap-1">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDisconnect}
            >
              {t('confirm')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirming(false)}
            >
              {t('cancel')}
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDisconnect}
            className="text-muted-foreground hover:text-destructive"
          >
            <Unplug className="h-3.5 w-3.5 mr-1.5" />
            {t('disconnect')}
          </Button>
        )}
      </div>
    </div>
  );
}
