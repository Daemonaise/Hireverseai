import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/api-auth';
import { createTransfer } from '@/lib/stripe-connect';
import { toCents } from '@/lib/stripe-fees';

export async function POST(req: NextRequest) {
  try {
    // This route is called server-side by the milestone service,
    // but we still verify auth for safety
    const uid = await verifyAuthToken(req);
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      amountDollars,
      destinationAccountId,
      projectId,
      milestoneId,
      freelancerId,
    } = await req.json();

    if (!amountDollars || !destinationAccountId || !projectId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const transferId = await createTransfer(
      toCents(amountDollars),
      destinationAccountId,
      `project_${projectId}`,
      {
        milestoneId: milestoneId ?? '',
        freelancerId: freelancerId ?? '',
      }
    );

    return NextResponse.json({ transferId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
