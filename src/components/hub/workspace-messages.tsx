'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ThreadList } from '@/components/messaging/thread-list';
import { ThreadView } from '@/components/messaging/thread-view';
import { useThreads, useMessageMutations } from '@/hooks/hub/use-messages';
import { useWorkspace } from '@/hooks/hub/use-workspace';
import { translateMessage } from '@/ai/flows/translate-message';
import { getThread } from '@/services/hub/messages';

interface WorkspaceMessagesProps {
  freelancerId: string;
  workspaceId: string;
}

export function WorkspaceMessages({ freelancerId, workspaceId }: WorkspaceMessagesProps) {
  const t = useTranslations('messaging');
  const locale = useLocale();
  const { data: threads = [], isLoading } = useThreads(workspaceId);
  const { data: workspace } = useWorkspace(freelancerId, workspaceId);
  const {
    createThread,
    postMessage,
    addTranslation,
  } = useMessageMutations(workspaceId);

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [newThreadOpen, setNewThreadOpen] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [sending, setSending] = useState(false);

  if (!workspace?.clientId) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        Connect a client to this workspace to start messaging.
      </div>
    );
  }

  async function handleCreateThread() {
    if (!newSubject.trim() || !workspace?.clientId) return;
    const threadId = await createThread.mutateAsync({
      workspaceId,
      freelancerId,
      clientId: workspace.clientId,
      subject: newSubject.trim(),
    });
    setNewSubject('');
    setNewThreadOpen(false);
    setSelectedThreadId(threadId);
  }

  async function handleSendMessage(text: string) {
    if (!selectedThreadId) return;
    setSending(true);
    try {
      const messageId = await postMessage.mutateAsync({
        threadId: selectedThreadId,
        input: {
          authorId: freelancerId,
          authorRole: 'freelancer',
          text,
          locale,
        },
      });

      // Translate for the other participant
      const thread = await getThread(selectedThreadId);
      const otherParticipant = thread?.participants.find((p) => p.id !== freelancerId);
      const targetLocale = otherParticipant?.locale;

      if (targetLocale && targetLocale !== locale) {
        try {
          const { translatedText } = await translateMessage({
            text,
            sourceLocale: locale,
            targetLocale,
          });
          await addTranslation.mutateAsync({
            threadId: selectedThreadId,
            messageId,
            locale: targetLocale,
            text: translatedText,
          });
        } catch {
          // Translation failed — message posted without translation
        }
      }
    } finally {
      setSending(false);
    }
  }

  async function handleRetryTranslation(_messageId: string) {
    // Could implement retry logic here
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-[600px] border rounded-lg bg-white">
      <div className="w-72 shrink-0">
        <ThreadList
          threads={threads}
          selectedThreadId={selectedThreadId}
          onSelectThread={setSelectedThreadId}
          onNewThread={() => setNewThreadOpen(true)}
        />
      </div>
      <div className="flex-1">
        {selectedThreadId ? (
          <ThreadView
            threadId={selectedThreadId}
            currentUserId={freelancerId}
            currentUserRole="freelancer"
            currentLocale={locale}
            onSendMessage={handleSendMessage}
            onRetryTranslation={handleRetryTranslation}
            sending={sending}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Select a thread or start a new conversation
          </div>
        )}
      </div>

      <Dialog open={newThreadOpen} onOpenChange={setNewThreadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('newThread')}</DialogTitle>
          </DialogHeader>
          <Input
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            placeholder={t('subject')}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateThread()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewThreadOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateThread} disabled={!newSubject.trim()}>
              {t('newThread')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
