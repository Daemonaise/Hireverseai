'use client';

import { ClientDashboard } from '@/components/client-dashboard';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { Loader2 } from 'lucide-react';
import React from 'react';

export function ClientDashboardLoader() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-destructive mb-4">Authentication required to view the dashboard.</p>
        <Link href="/client/login">
          <Button>Go to Client Login</Button>
        </Link>
      </div>
    );
  }

  return <ClientDashboard clientId={user.uid} />;
}
