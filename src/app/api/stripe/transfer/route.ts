import { NextRequest, NextResponse } from 'next/server';
import { createTransfer } from '@/lib/stripe-connect';
import { toCents } from '@/lib/stripe-fees';
import { adminDb } from '@/lib/firebase-admin';

// Internal-only endpoint: requires a shared secret, NOT user auth.
// This should only be called by server-side milestone completion logic.
const INTERNAL_SECRET = process.env.HIREVERSE_INGESTION_API_KEY;

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('X-Internal-Secret');
    if (!INTERNAL_SECRET || authHeader !== INTERNAL_SECRET) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const {
      amountDollars,
      destinationAccountId,
      projectId,
      milestoneId,
      freelancerId,
    } = await req.json();

    if (!amountDollars || !destinationAccountId || !projectId || !freelancerId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify the project exists and the freelancer is assigned
    const projectSnap = await adminDb.collection('projects').doc(projectId).get();
    if (!projectSnap.exists) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const project = projectSnap.data();
    if (project?.assignedFreelancerId !== freelancerId) {
      return NextResponse.json({ error: 'Freelancer not assigned to this project' }, { status: 403 });
    }

    // Verify the destination account belongs to this freelancer
    const freelancerSnap = await adminDb.collection('freelancers').doc(freelancerId).get();
    if (!freelancerSnap.exists || freelancerSnap.data()?.stripeAccountId !== destinationAccountId) {
      return NextResponse.json({ error: 'Invalid destination account' }, { status: 403 });
    }

    const transferId = await createTransfer(
      toCents(amountDollars),
      destinationAccountId,
      `project_${projectId}`,
      {
        milestoneId: milestoneId ?? '',
        freelancerId,
      }
    );

    return NextResponse.json({ transferId });
  } catch {
    return NextResponse.json({ error: 'Transfer failed' }, { status: 500 });
  }
}
