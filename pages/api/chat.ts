import { type NextRequest } from 'next/server';
import { chatWithClientAgent, type ClientChatHistory } from '@/ai/flows/client-chat-agent';
import { Message, StreamingTextResponse } from 'ai';

export const runtime = 'edge';

// Simple in-memory cache for demonstration purposes
const historyCache = new Map<string, ClientChatHistory>();

export default async function handler(req: NextRequest) {
  try {
    const { messages, clientId } = await req.json();

    if (!clientId) {
      return new Response('Client ID is required.', { status: 400 });
    }
    if (!messages || !Array.isArray(messages)) {
      return new Response('Invalid messages format.', { status: 400 });
    }

    // Retrieve or initialize history from cache
    let history = historyCache.get(clientId) || [];

    // Append new user messages to history
    const newMessages = messages as Message[];
    history.push(...newMessages.slice(history.length)); // Append only new messages

    // Call the Genkit flow
    const responseText = await chatWithClientAgent(clientId, history);
    
    // Append AI response to history
    history.push({ id: `ai-${Date.now()}`, role: 'assistant', content: responseText });

    // Update cache
    historyCache.set(clientId, history);

    // Create a simple ReadableStream to send the response
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(responseText);
        controller.close();
      },
    });

    return new StreamingTextResponse(stream);

  } catch (error) {
    console.error('[Chat API Error]', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
