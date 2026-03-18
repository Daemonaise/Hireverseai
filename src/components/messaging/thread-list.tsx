'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, MessageSquare } from 'lucide-react';
import type { Thread } from '@/types/hub';
import { Timestamp } from 'firebase/firestore';

interface ThreadListProps {
  threads: Thread[];
  selectedThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onNewThread: () => void;
}

function formatRelative(ts: Timestamp): string {
  const date = ts instanceof Timestamp ? ts.toDate() : new Date(ts as unknown as string);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function ThreadList({
  threads,
  selectedThreadId,
  onSelectThread,
  onNewThread,
}: ThreadListProps) {
  const t = useTranslations('messaging');

  return (
    <div className="flex flex-col h-full border-r">
      <div className="p-3 border-b">
        <Button size="sm" onClick={onNewThread} className="w-full">
          <Plus className="h-4 w-4 mr-1" />
          {t('newThread')}
        </Button>
      </div>
      <ScrollArea className="flex-1">
        {threads.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {t('noThreads')}
          </div>
        ) : (
          threads.map((thread) => (
            <button
              key={thread.id}
              onClick={() => onSelectThread(thread.id)}
              className={`w-full text-left px-3 py-3 border-b hover:bg-gray-50 transition-colors ${
                selectedThreadId === thread.id ? 'bg-primary/10' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="font-medium text-sm truncate">{thread.subject}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatRelative(thread.lastMessageAt)}
              </p>
            </button>
          ))
        )}
      </ScrollArea>
    </div>
  );
}
