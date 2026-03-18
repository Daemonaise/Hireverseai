'use client';

import { useState, useCallback } from 'react';
import {
  RefreshCw,
  ExternalLink,
  Loader2,
  MessageSquare,
  Github,
  HardDrive,
  LayoutGrid,
  BookOpen,
  Plus,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import type { ComponentType } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useActivityEvents } from '@/hooks/hub/use-activity';
import { useConnections } from '@/hooks/hub/use-connections';
import { useHubStore } from '@/stores/hub-store';
import { useTranslations } from 'next-intl';
import { syncWorkspaceActivity } from '@/services/hub/sync';
import { getProviderConfig, PROVIDER_CONFIGS } from '@/services/integrations/types';
import type {
  ProviderId,
  ActivitySourceType,
  WorkspaceConnection,
  CreateItemPayload,
} from '@/types/hub';
import type { Timestamp } from 'firebase/firestore';

// Map Lucide icon names from PROVIDER_CONFIGS to actual components
const PROVIDER_ICON_MAP: Record<string, ComponentType<LucideProps>> = {
  MessageSquare,
  Github,
  HardDrive,
  LayoutGrid,
  BookOpen,
};

const PROVIDER_OPTIONS: { value: 'all' | ProviderId; label: string }[] = [
  { value: 'all', label: 'All providers' },
  ...Object.values(PROVIDER_CONFIGS).map((cfg) => ({
    value: cfg.id,
    label: cfg.name,
  })),
];

const SOURCE_TYPE_OPTIONS: { value: 'all' | ActivitySourceType; label: string }[] = [
  { value: 'all', label: 'All types' },
  { value: 'task', label: 'Task' },
  { value: 'message', label: 'Message' },
  { value: 'document', label: 'Document' },
  { value: 'ticket', label: 'Ticket' },
  { value: 'repository_event', label: 'Repository Event' },
];

function formatTimestamp(ts: Timestamp | null | undefined): string {
  if (!ts) return '—';
  const date =
    typeof (ts as { toDate?: () => Date }).toDate === 'function'
      ? (ts as { toDate: () => Date }).toDate()
      : new Date(ts as unknown as string);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function truncate(text: string, maxLen = 120): string {
  if (!text) return '';
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}

function ProviderIcon({ provider }: { provider: ProviderId }) {
  const config = getProviderConfig(provider);
  const Icon = PROVIDER_ICON_MAP[config.icon] ?? MessageSquare;
  return <Icon className="h-4 w-4 shrink-0 text-gray-500" />;
}

// --- Write action types ---

interface ActionDef {
  label: string;
  provider: ProviderId;
  payloadType: CreateItemPayload['type'];
  /** Extra fields beyond title + body */
  extraFields: ExtraField[];
}

interface ExtraField {
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
}

const ACTION_DEFS: ActionDef[] = [
  {
    label: 'Create Issue',
    provider: 'github',
    payloadType: 'issue',
    extraFields: [
      { key: 'repo', label: 'Repository (owner/repo)', placeholder: 'e.g. acme/my-repo', required: true },
    ],
  },
  {
    label: 'Create Card',
    provider: 'trello',
    payloadType: 'card',
    extraFields: [
      { key: 'listId', label: 'List ID', placeholder: 'Trello list ID', required: true },
    ],
  },
  {
    label: 'Send Message',
    provider: 'slack',
    payloadType: 'message',
    extraFields: [
      { key: 'channel', label: 'Channel', placeholder: '#general or channel ID', required: true },
    ],
  },
  {
    label: 'Create Document',
    provider: 'google-drive',
    payloadType: 'file',
    extraFields: [],
  },
  {
    label: 'Create Page',
    provider: 'notion',
    payloadType: 'page',
    extraFields: [
      { key: 'databaseId', label: 'Database ID', placeholder: 'Notion database ID', required: true },
    ],
  },
];

/** Determine which action buttons to show based on filterSourceType and connected providers */
function getVisibleActions(
  filterSourceType: string | string[] | undefined,
  connections: WorkspaceConnection[]
): ActionDef[] {
  const connectedProviders = new Set(
    connections.filter((c) => c.status === 'connected').map((c) => c.provider)
  );

  const types = Array.isArray(filterSourceType)
    ? filterSourceType
    : filterSourceType
    ? [filterSourceType]
    : [];

  const isTaskOrTicket = types.length === 0 || types.some((t) => t === 'task' || t === 'ticket');
  const isMessage = types.length === 0 || types.includes('message');
  const isDocument = types.length === 0 || types.includes('document');

  return ACTION_DEFS.filter((action) => {
    if (!connectedProviders.has(action.provider)) return false;
    if (action.provider === 'github' || action.provider === 'trello') return isTaskOrTicket;
    if (action.provider === 'slack') return isMessage;
    if (action.provider === 'google-drive' || action.provider === 'notion') return isDocument;
    return false;
  });
}

/** Dynamically import the createItem function for a given provider */
async function getCreateItemFn(
  provider: ProviderId
): Promise<(nangoConnectionId: string, payload: CreateItemPayload) => Promise<void>> {
  switch (provider) {
    case 'github': {
      const mod = await import('@/services/integrations/github');
      return mod.createItem;
    }
    case 'slack': {
      const mod = await import('@/services/integrations/slack');
      return mod.createItem;
    }
    case 'trello': {
      const mod = await import('@/services/integrations/trello');
      return mod.createItem;
    }
    case 'google-drive': {
      const mod = await import('@/services/integrations/google-drive');
      return mod.createItem;
    }
    case 'notion': {
      const mod = await import('@/services/integrations/notion');
      return mod.createItem;
    }
  }
}

// --- Component ---

interface ActivityTimelineProps {
  freelancerId: string;
  workspaceId: string;
  filterSourceType?: string | string[];
}

export function ActivityTimeline({
  freelancerId,
  workspaceId,
  filterSourceType,
}: ActivityTimelineProps) {
  const { toast } = useToast();
  const t = useTranslations('activity');
  const { activeFilters, setFilter } = useHubStore();

  const providerFilter = activeFilters.provider;
  const sourceTypeFilter = filterSourceType || activeFilters.sourceType;

  // Resolve the prop-driven source type filter (use first value if array)
  const resolvedSourceType: ActivitySourceType | undefined = Array.isArray(sourceTypeFilter)
    ? (sourceTypeFilter[0] as ActivitySourceType | undefined)
    : (sourceTypeFilter as ActivitySourceType | undefined);

  const { data: events = [], isLoading: loading, refetch } = useActivityEvents(
    freelancerId, workspaceId,
    {
      provider: (providerFilter && providerFilter !== 'all' ? providerFilter : undefined) as ProviderId | undefined,
      sourceType: resolvedSourceType && resolvedSourceType !== 'all' ? resolvedSourceType : undefined,
    }
  );
  const { data: connections = [] } = useConnections(freelancerId, workspaceId);

  const [syncing, setSyncing] = useState(false);

  // Write action state
  const [activeAction, setActiveAction] = useState<ActionDef | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formExtras, setFormExtras] = useState<Record<string, string>>({});
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await syncWorkspaceActivity(freelancerId, workspaceId);
      if (result.failed.length === 0) {
        toast({
          title: t('syncComplete'),
          description: `${t('synced')} ${result.totalEvents} ${t('eventsFrom')} ${result.synced.length} ${t('providers')}.`,
        });
      } else {
        toast({
          title: t('syncFinishedWithErrors'),
          description: `${t('synced')} ${result.synced.length} ${t('providers')}. ${t('failed')}: ${result.failed.join(', ')}.`,
          variant: 'destructive',
        });
      }
      await refetch();
    } catch {
      toast({
        title: t('syncFailed'),
        description: t('syncFailedDescription'),
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  }, [freelancerId, workspaceId, refetch, toast, t]);

  // Open create dialog for a given action
  const openActionDialog = useCallback((action: ActionDef) => {
    setActiveAction(action);
    setFormTitle('');
    setFormBody('');
    setFormExtras({});
  }, []);

  const closeActionDialog = useCallback(() => {
    setActiveAction(null);
    setPendingSubmit(false);
  }, []);

  // Called when user submits the form — show confirmation first
  const handleFormSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!activeAction) return;
      setPendingSubmit(true);
      setShowConfirm(true);
    },
    [activeAction]
  );

  // Called when user confirms in the alert dialog
  const handleConfirmedSubmit = useCallback(async () => {
    if (!activeAction) return;
    setShowConfirm(false);
    setSubmitting(true);

    // Find the connection for the provider
    const connection = connections.find(
      (c) => c.provider === activeAction.provider && c.status === 'connected'
    );
    if (!connection) {
      toast({
        title: t('noActiveConnection'),
        description: `${t('noConnectedAccount')} ${activeAction.provider}.`,
        variant: 'destructive',
      });
      setSubmitting(false);
      setPendingSubmit(false);
      return;
    }

    const payload: CreateItemPayload = {
      type: activeAction.payloadType,
      title: formTitle,
      body: formBody || undefined,
      metadata: Object.keys(formExtras).length > 0 ? { ...formExtras } : undefined,
    };

    try {
      const createItem = await getCreateItemFn(activeAction.provider);
      await createItem(connection.nangoConnectionId, payload);
      toast({
        title: t('createdSuccessfully'),
        description: `${activeAction.label} ${t('wasCreatedIn')} ${getProviderConfig(activeAction.provider).name}.`,
      });
      closeActionDialog();
    } catch (err) {
      toast({
        title: t('createFailed'),
        description: err instanceof Error ? err.message : t('unexpectedError'),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
      setPendingSubmit(false);
    }
  }, [activeAction, connections, formTitle, formBody, formExtras, toast, closeActionDialog, t]);

  const showSourceTypeDropdown = !filterSourceType;
  const visibleActions = getVisibleActions(filterSourceType, connections);

  // Provider display name for confirm dialog
  const confirmProviderName = activeAction
    ? getProviderConfig(activeAction.provider).name
    : '';

  return (
    <Card className="border border-gray-200 bg-white">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base font-semibold text-gray-900">{t('activityTimeline')}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {/* Write action buttons */}
            {visibleActions.map((action) => (
              <Button
                key={`${action.provider}-${action.payloadType}`}
                size="sm"
                variant="outline"
                onClick={() => openActionDialog(action)}
                className="w-full sm:w-auto"
              >
                <Plus className="mr-2 h-4 w-4" />
                {action.label}
              </Button>
            ))}
            {/* Sync button */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleSync}
              disabled={syncing}
              className="w-full sm:w-auto"
            >
              {syncing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {syncing ? t('syncing') : t('syncNow')}
            </Button>
          </div>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap gap-2 pt-1">
          {/* Provider filter */}
          <Select
            value={providerFilter || 'all'}
            onValueChange={(v) => setFilter('provider', v === 'all' ? undefined : v)}
          >
            <SelectTrigger className="h-8 w-44 text-sm">
              <SelectValue placeholder={t('allProviders')} />
            </SelectTrigger>
            <SelectContent>
              {PROVIDER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-sm">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Source type filter — hidden when controlled by prop */}
          {showSourceTypeDropdown && (
            <Select
              value={(activeFilters.sourceType as string) || 'all'}
              onValueChange={(v) => setFilter('sourceType', v === 'all' ? undefined : v)}
            >
              <SelectTrigger className="h-8 w-44 text-sm">
                <SelectValue placeholder={t('allTypes')} />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-sm">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : events.length === 0 ? (
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50">
            <p className="px-6 text-center text-sm text-gray-500">
              {t('noActivityYet')}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[520px] pr-4">
            <ol className="relative border-l border-gray-200">
              {events.map((event) => (
                <li key={event.id} className="mb-6 ml-4 last:mb-0">
                  {/* Timeline dot */}
                  <span className="absolute -left-1.5 mt-1 flex h-3 w-3 items-center justify-center rounded-full border border-white bg-primary" />

                  <div className="flex flex-col gap-1">
                    {/* Top row: provider icon + title + status badge + open link */}
                    <div className="flex flex-wrap items-start gap-2">
                      <ProviderIcon provider={event.sourceProvider} />
                      <span className="flex-1 text-sm font-medium text-gray-900 leading-snug">
                        {event.title}
                      </span>
                      {event.status && (
                        <Badge variant="secondary" className="shrink-0 capitalize text-xs">
                          {event.status}
                        </Badge>
                      )}
                      {event.url && (
                        <a
                          href={event.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-primary hover:opacity-80"
                          aria-label={t('openSource')}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>

                    {/* Body excerpt */}
                    {event.bodyExcerpt && (
                      <p className="ml-6 text-sm text-gray-500 leading-relaxed">
                        {truncate(event.bodyExcerpt)}
                      </p>
                    )}

                    {/* Timestamp */}
                    <time className="ml-6 text-xs text-gray-400">
                      {formatTimestamp(event.createdAt)}
                    </time>
                  </div>
                </li>
              ))}
            </ol>
          </ScrollArea>
        )}
      </CardContent>

      {/* Create item dialog */}
      <Dialog open={!!activeAction} onOpenChange={(open) => { if (!open) closeActionDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{activeAction?.label}</DialogTitle>
          </DialogHeader>
          {activeAction && (
            <form onSubmit={handleFormSubmit} className="flex flex-col gap-4 pt-2">
              {/* Title */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="action-title">{t('title')}</Label>
                <Input
                  id="action-title"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={t('enterTitle')}
                  required
                />
              </div>

              {/* Body */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="action-body">{t('bodyOptional')}</Label>
                <Textarea
                  id="action-body"
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  placeholder={t('enterDescription')}
                  rows={3}
                />
              </div>

              {/* Extra provider-specific fields */}
              {activeAction.extraFields.map((field) => (
                <div key={field.key} className="flex flex-col gap-1.5">
                  <Label htmlFor={`action-${field.key}`}>{field.label}</Label>
                  <Input
                    id={`action-${field.key}`}
                    value={formExtras[field.key] ?? ''}
                    onChange={(e) =>
                      setFormExtras((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    placeholder={field.placeholder}
                    required={field.required}
                  />
                </div>
              ))}

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={closeActionDialog}>
                  {t('cancel')}
                </Button>
                <Button type="submit" disabled={pendingSubmit || submitting}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {submitting ? t('creating') : t('create')}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation alert dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmAction')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('confirmCreateDescription', { type: activeAction?.payloadType, provider: confirmProviderName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowConfirm(false); setPendingSubmit(false); }}>
              {t('cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmedSubmit}>
              {t('continue')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
