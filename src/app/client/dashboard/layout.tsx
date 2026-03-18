'use client';

import { useAuth } from '@/contexts/auth-context';
import { AppShell } from '@/components/app-shell/app-shell';
import { Loader2 } from 'lucide-react';

export default function ClientDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-chrome">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-chrome">
        <p className="text-chrome-foreground">Please log in to access the dashboard.</p>
      </div>
    );
  }

  return (
    <AppShell role="client" title="Dashboard">
      {children}
    </AppShell>
  );
}
