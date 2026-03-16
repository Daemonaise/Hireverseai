'use client';

import { use } from 'react';
import { WorkspaceDetail } from '@/components/hub/workspace-detail';

const FREELANCER_ID = 'dev-react-001';

export default function WorkspaceDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  return <WorkspaceDetail freelancerId={FREELANCER_ID} workspaceId={workspaceId} />;
}
