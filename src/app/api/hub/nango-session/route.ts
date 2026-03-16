import { NextRequest, NextResponse } from 'next/server';
import { nango } from '@/lib/nango';
import { verifyAuthToken } from '@/lib/api-auth';

export async function POST(req: NextRequest) {
  try {
    const uid = await verifyAuthToken(req);
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { freelancerId, workspaceId, provider } = await req.json();

    if (!freelancerId || !workspaceId || !provider) {
      return NextResponse.json(
        { error: 'freelancerId, workspaceId, and provider are required' },
        { status: 400 }
      );
    }

    const { data } = await nango.createConnectSession({
      tags: {
        end_user_id: freelancerId,
        workspace_id: workspaceId,
      },
      allowed_integrations: [provider],
    });

    return NextResponse.json({ sessionToken: data.token, workspaceId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
