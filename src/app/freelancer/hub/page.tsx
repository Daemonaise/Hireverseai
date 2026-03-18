'use client';

import { useAuth } from '@/contexts/auth-context';
import { HubDashboard } from '@/components/hub/hub-dashboard';
import { Loader2 } from 'lucide-react';

export default function HubPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

  return <HubDashboard freelancerId={user.uid} />;
}
