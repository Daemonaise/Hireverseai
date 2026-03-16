'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  RefreshCw,
  ExternalLink,
  Loader2,
  MessageSquare,
  Github,
  HardDrive,
  LayoutGrid,
  BookOpen,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import type { ComponentType } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { listActivityEvents } from '@/services/hub/activity';
import { syncWorkspaceActivity } from '@/services/hub/sync';
import { getProviderConfig, PROVIDER_CONFIGS } from '@/services/integrations/types';
import type { ProviderId, ActivitySourceType, NormalizedActivity } from '@/types/hub';
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

  const [events, setEvents] = useState<NormalizedActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [providerFilter, setProviderFilter] = useState<'all' | ProviderId>('all');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<'all' | ActivitySourceType>('all');

  // Resolve the prop-driven source type filter (use first value if array)
  const propSourceType: ActivitySourceType | undefined = Array.isArray(filterSourceType)
    ? (filterSourceType[0] as ActivitySourceType | undefined)
    : (filterSourceType as ActivitySourceType | undefined);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listActivityEvents(freelancerId, workspaceId, {
        provider: providerFilter === 'all' ? undefined : providerFilter,
        sourceType: propSourceType ?? (sourceTypeFilter === 'all' ? undefined : sourceTypeFilter),
      });
      setEvents(data);
    } finally {
      setLoading(false);
    }
  }, [freelancerId, workspaceId, providerFilter, sourceTypeFilter, propSourceType]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await syncWorkspaceActivity(freelancerId, workspaceId);
      if (result.failed.length === 0) {
        toast({
          title: 'Sync complete',
          description: `Synced ${result.totalEvents} event${result.totalEvents !== 1 ? 's' : ''} from ${result.synced.length} provider${result.synced.length !== 1 ? 's' : ''}.`,
        });
      } else {
        toast({
          title: 'Sync finished with errors',
          description: `Synced ${result.synced.length} provider${result.synced.length !== 1 ? 's' : ''}. Failed: ${result.failed.join(', ')}.`,
          variant: 'destructive',
        });
      }
      await fetchEvents();
    } catch {
      toast({
        title: 'Sync failed',
        description: 'An unexpected error occurred while syncing activity.',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  }, [freelancerId, workspaceId, fetchEvents, toast]);

  const showSourceTypeDropdown = !propSourceType;

  return (
    <Card className="border border-gray-200 bg-white">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base font-semibold text-gray-900">Activity Timeline</CardTitle>
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
            {syncing ? 'Syncing…' : 'Sync Now'}
          </Button>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap gap-2 pt-1">
          {/* Provider filter */}
          <Select
            value={providerFilter}
            onValueChange={(v) => setProviderFilter(v as 'all' | ProviderId)}
          >
            <SelectTrigger className="h-8 w-44 text-sm">
              <SelectValue placeholder="All providers" />
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
              value={sourceTypeFilter}
              onValueChange={(v) => setSourceTypeFilter(v as 'all' | ActivitySourceType)}
            >
              <SelectTrigger className="h-8 w-44 text-sm">
                <SelectValue placeholder="All types" />
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
              No activity yet. Connect an app and sync to get started.
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
                          aria-label="Open source"
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
    </Card>
  );
}
