'use client';

import { use } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { WorkspaceDetail } from '@/components/hub/workspace-detail';
import { SkeletonTabs } from '@/components/ui/skeleton-tabs';

export default function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  const { user, loading } = useAuth();

  if (loading) {
    return <SkeletonTabs tabs={6} className="max-w-6xl mx-auto p-6" />;
  }

  if (!user) return null;

  return <WorkspaceDetail freelancerId={user.uid} workspaceId={workspaceId} />;
}
