import { NextRequest, NextResponse } from 'next/server';
import { chatWithClientAgent, type ClientChatHistory } from '@/ai/flows/client-chat-agent';
import { type Message } from 'ai';

// Simple in-memory cache for demonstration purposes
const historyCache = new Map<string, ClientChatHistory>();

export async function POST(req: NextRequest) {
  try {
    const { messages, clientId } = await req.json();

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID is required.' }, { status: 400 });
    }
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages format.' }, { status: 400 });
    }

    // The chat hook sends the whole history, so we just use it directly
    const history: ClientChatHistory = messages as Message[];

    // Call the Genkit flow
    const responseText = await chatWithClientAgent(clientId, history);

    // Append AI response to history and update cache
    const updatedHistory = [
      ...history,
      { id: `ai-${Date.now()}`, role: 'assistant' as const, content: responseText },
    ];
    historyCache.set(clientId, updatedHistory);

    // Return as a simple text stream
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(responseText));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error) {
    console.error('[Chat API Error]', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
