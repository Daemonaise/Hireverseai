'use client';

import { useState, useTransition } from 'react';
import { useChat, type Message } from 'ai/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { chatWithClientAgent } from '@/ai/flows/client-chat-agent';

interface ClientChatAgentProps {
  clientId: string;
}

export function ClientChatAgent({ clientId }: ClientChatAgentProps) {
  const [isPending, startTransition] = useTransition();

  const { messages, input, handleInputChange, handleSubmit, append, isLoading } = useChat({
    // The `body` object is passed to the API route. We add our client ID here.
    body: {
      clientId: clientId,
    },
    // The `onFinish` callback is called when the stream is complete.
    // Here we can re-enable the UI or perform other actions.
    onFinish(message) {
      console.log('Chat stream finished.');
    },
    // The `onError` callback is called if an error occurs.
    onError(error) {
      console.error('Chat error:', error);
    },
  });

  return (
    <Card className="w-full h-[600px] flex flex-col shadow-2xl rounded-xl">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" />
          <span>AI Project Assistant</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full p-4">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <p>Ask me about your projects or start a new one!</p>
                <p className="text-xs mt-2">e.g., "List my projects" or "Start a project to build a landing page."</p>
              </div>
            )}
            {messages.map((m: Message) => (
              <div
                key={m.id}
                className={cn(
                  'flex gap-3 text-sm',
                  m.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {m.role !== 'user' && (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <Bot className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={cn(
                    'rounded-lg px-3 py-2 max-w-sm',
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                >
                  {m.content}
                </div>
                 {m.role === 'user' && (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      <User className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
             {isLoading && (
              <div className="flex justify-start gap-3 text-sm">
                 <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <Bot className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="rounded-lg px-3 py-2 bg-muted flex items-center">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      <div className="border-t p-4">
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2"
        >
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask about your projects..."
            className="flex-1"
            disabled={isLoading}
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </div>
    </Card>
  );
}
