import { NextRequest, NextResponse } from 'next/server';
import { workspaceChatAgent } from '@/ai/flows/workspace-chat-agent';
import { verifyAuthToken } from '@/lib/api-auth';

export async function POST(req: NextRequest) {
  try {
    const uid = await verifyAuthToken(req);
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId, freelancerId, messages } = await req.json();

    if (!workspaceId || !freelancerId) {
      return NextResponse.json(
        { error: 'workspaceId and freelancerId are required' },
        { status: 400 }
      );
    }

    if (uid !== freelancerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
    }

    const responseText = await workspaceChatAgent({
      workspaceId,
      freelancerId,
      messages,
    });

    return NextResponse.json({ response: responseText });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
