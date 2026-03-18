'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, MessageSquare } from 'lucide-react';
import type { Thread } from '@/types/hub';
import { formatRelative } from '@/lib/timestamp';

interface ThreadListProps {
  threads: Thread[];
  selectedThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onNewThread: () => void;
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
