'use client';

import { use } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { WorkspaceDetail } from '@/components/hub/workspace-detail';
import { Loader2 } from 'lucide-react';

export default function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

  return <WorkspaceDetail freelancerId={user.uid} workspaceId={workspaceId} />;
}
