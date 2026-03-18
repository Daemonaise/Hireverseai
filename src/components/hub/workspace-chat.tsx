'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslations } from 'next-intl';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface WorkspaceChatProps {
  freelancerId: string;
  workspaceId: string;
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 shrink-0">
        <Bot className="h-4 w-4 text-gray-600" />
      </div>
      <div className="rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-3">
        <div className="flex items-center gap-1">
          <span
            className="h-2 w-2 rounded-full bg-gray-400 animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="h-2 w-2 rounded-full bg-gray-400 animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="h-2 w-2 rounded-full bg-gray-400 animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>
    </div>
  );
}

export function WorkspaceChat({ freelancerId, workspaceId }: WorkspaceChatProps) {
  const t = useTranslations('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll whenever messages change or typing indicator appears
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  async function handleSend() {
    const text = input.trim();
    if (!text || typing) return;

    const newMessage: ChatMessage = { role: 'user', content: text };
    const updatedMessages = [...messages, newMessage];

    setMessages(updatedMessages);
    setInput('');
    setTyping(true);
    setError(null);

    try {
      const res = await fetch('/api/hub/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ',
        },
        body: JSON.stringify({
          workspaceId,
          freelancerId,
          messages: updatedMessages,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `${t('requestFailed')} (${res.status})`);
      }

      const data = await res.json();
      const responseText: string =
        typeof data.response === 'string'
          ? data.response
          : data.response?.responseText ?? '';

      setMessages((prev) => [...prev, { role: 'assistant', content: responseText }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('somethingWentWrong'));
    } finally {
      setTyping(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <Card className="flex flex-col bg-white overflow-hidden h-[520px]">
      {/* Message list */}
      <ScrollArea className="flex-1 px-4 py-4">
        {messages.length === 0 && !typing ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-16">
            <Bot className="h-8 w-8 opacity-40" />
            <p className="text-sm">{t('askAnything')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) =>
              msg.role === 'user' ? (
                <div key={i} className="flex items-end justify-end gap-2">
                  <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-4 py-2.5 text-sm leading-relaxed">
                    {msg.content}
                  </div>
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary shrink-0">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                </div>
              ) : (
                <div key={i} className="flex items-end gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 shrink-0">
                    <Bot className="h-4 w-4 text-gray-600" />
                  </div>
                  <div className="max-w-[75%] rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-2.5 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                    {msg.content}
                  </div>
                </div>
              )
            )}
            {typing && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 text-destructive text-xs border-t">
          {error}
        </div>
      )}

      {/* Input area */}
      <div className="border-t px-4 py-3 flex items-center gap-2 bg-white">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('messagePlaceholder')}
          disabled={typing}
          className="flex-1"
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!input.trim() || typing}
          aria-label={t('sendMessage')}
        >
          {typing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </Card>
  );
}
