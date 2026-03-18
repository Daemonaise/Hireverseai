'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Loader2 } from 'lucide-react';
import { MessageBubble } from './message-bubble';
import { useMessages } from '@/hooks/hub/use-messages';
import type { ThreadMessage } from '@/types/hub';

interface ThreadViewProps {
  threadId: string;
  currentUserId: string;
  currentUserRole: 'freelancer' | 'client';
  currentLocale: string;
  onSendMessage: (text: string) => void;
  onRetryTranslation?: (messageId: string) => void;
  sending?: boolean;
}

export function ThreadView({
  threadId,
  currentUserId,
  currentUserRole,
  currentLocale,
  onSendMessage,
  onRetryTranslation,
  sending,
}: ThreadViewProps) {
  const t = useTranslations('messaging');
  const { data: messages = [], isLoading } = useMessages(threadId);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    onSendMessage(text);
    setInput('');
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            {t('noMessages')}
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              currentUserId={currentUserId}
              currentLocale={currentLocale}
              onRetryTranslation={onRetryTranslation}
            />
          ))
        )}
        <div ref={bottomRef} />
      </ScrollArea>
      <div className="border-t p-3 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('composePlaceholder')}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          disabled={sending}
        />
        <Button size="sm" onClick={handleSend} disabled={!input.trim() || sending}>
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
