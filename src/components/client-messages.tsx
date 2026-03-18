'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { ThreadList } from '@/components/messaging/thread-list';
import { ThreadView } from '@/components/messaging/thread-view';
import { useClientThreads, useMessageMutations } from '@/hooks/hub/use-messages';
import { translateMessage } from '@/ai/flows/translate-message';
import { getThread } from '@/services/hub/messages';

interface ClientMessagesProps {
  clientId: string;
}

export function ClientMessages({ clientId }: ClientMessagesProps) {
  const t = useTranslations('messaging');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { data: threads = [], isLoading } = useClientThreads(clientId);
  const { postMessage, addTranslation } = useMessageMutations('');

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function handleSendMessage(text: string) {
    if (!selectedThreadId) return;
    setSending(true);
    try {
      const messageId = await postMessage.mutateAsync({
        threadId: selectedThreadId,
        input: {
          authorId: clientId,
          authorRole: 'client',
          text,
          locale,
        },
      });

      // Invalidate client thread list
      queryClient.invalidateQueries({ queryKey: ['threads-client', clientId] });

      // Translate for the other participant
      const thread = await getThread(selectedThreadId);
      const otherParticipant = thread?.participants.find((p) => p.id !== clientId);
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
          // Translation failed
        }
      }
    } finally {
      setSending(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-[500px] border rounded-lg bg-white">
      <div className="w-72 shrink-0">
        <ThreadList
          threads={threads}
          selectedThreadId={selectedThreadId}
          onSelectThread={setSelectedThreadId}
          onNewThread={() => {}} // Clients can't create threads — only freelancers can
        />
      </div>
      <div className="flex-1">
        {selectedThreadId ? (
          <ThreadView
            threadId={selectedThreadId}
            currentUserId={clientId}
            currentUserRole="client"
            currentLocale={locale}
            onSendMessage={handleSendMessage}
            sending={sending}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Select a conversation to view messages
          </div>
        )}
      </div>
    </div>
  );
}
