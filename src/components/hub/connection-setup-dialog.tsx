'use client';

import { useState } from 'react';
import { MessageSquare, Github, HardDrive, LayoutGrid, BookOpen, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PROVIDER_CONFIGS } from '@/services/integrations/types';
import { createConnection } from '@/services/hub/connections';
import { useTranslations } from 'next-intl';
import type { ProviderId } from '@/types/hub';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageSquare,
  Github,
  HardDrive,
  LayoutGrid,
  BookOpen,
};

interface ConnectionSetupDialogProps {
  freelancerId: string;
  workspaceId: string;
  existingProviders: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnectionCreated: () => void;
}

export function ConnectionSetupDialog({
  freelancerId,
  workspaceId,
  existingProviders,
  open,
  onOpenChange,
  onConnectionCreated,
}: ConnectionSetupDialogProps) {
  const [connecting, setConnecting] = useState<ProviderId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations('connections');

  const availableProviders = Object.values(PROVIDER_CONFIGS).filter(
    (config) => !existingProviders.includes(config.id)
  );

  async function handleConnect(providerId: ProviderId) {
    setConnecting(providerId);
    setError(null);
    const config = PROVIDER_CONFIGS[providerId];

    try {
      const res = await fetch('/api/hub/nango-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          freelancerId,
          workspaceId,
          provider: config.nangoIntegrationId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? t('failedToCreateSession'));
      }

      const { sessionToken } = await res.json();

      const { default: NangoFrontend } = await import('@nangohq/frontend');
      const nangoFrontend = new NangoFrontend({
        publicKey: process.env.NEXT_PUBLIC_NANGO_PUBLIC_KEY!,
      });

      const connect = nangoFrontend.openConnectUI({
        onEvent: (event: { type: string; payload: { connectionId: string } }) => {
          if (event.type === 'connect') {
            createConnection(
              freelancerId,
              workspaceId,
              providerId,
              event.payload.connectionId,
              config.nangoIntegrationId,
              config.name,
              config.defaultLaunchUrl
            ).then(() => {
              onConnectionCreated();
              onOpenChange(false);
            });
          }
        },
      });

      connect.setSessionToken(sessionToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('somethingWentWrong'));
    } finally {
      setConnecting(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('connectIntegration')}</DialogTitle>
        </DialogHeader>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        {availableProviders.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {t('allIntegrationsConnected')}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 mt-2">
            {availableProviders.map((config) => {
              const IconComponent = ICON_MAP[config.icon] ?? HardDrive;
              const isConnecting = connecting === config.id;
              return (
                <button
                  key={config.id}
                  onClick={() => handleConnect(config.id)}
                  disabled={connecting !== null}
                  className="flex flex-col items-center gap-2 p-4 rounded-lg border bg-white hover:bg-gray-50 hover:border-primary/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-100">
                    {isConnecting ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : (
                      <IconComponent className="h-5 w-5 text-foreground" />
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">{config.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {config.category.replace('-', ' ')}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
