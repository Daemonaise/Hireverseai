'use client';

import { useAuth } from '@/contexts/auth-context';
import { HubSidebar } from '@/components/hub/hub-sidebar';
import { Loader2 } from 'lucide-react';

export default function HubLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Please log in to access the hub.</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <HubSidebar freelancerId={user.uid} />
      <main className="flex-1 overflow-auto bg-gray-50">{children}</main>
    </div>
  );
}
