'use client';

import { ReactNode } from 'react';
import { HubSidebar } from '@/components/hub/hub-sidebar';

const FREELANCER_ID = 'dev-react-001';

export default function HubLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen">
      <HubSidebar freelancerId={FREELANCER_ID} />
      <main className="flex-1 overflow-auto bg-gray-50">
        {children}
      </main>
    </div>
  );
}
