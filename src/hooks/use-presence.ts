'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { ActivityCollector } from '@/lib/presence/activity-collector';

const REPORT_INTERVAL_MS = 60_000; // Report every 60 seconds

/**
 * Hook that monitors freelancer activity and reports presence to the server.
 * Mount this in the hub layout — it runs silently in the background.
 */
export function usePresence(freelancerId: string) {
  const { user } = useAuth();
  const collectorRef = useRef<ActivityCollector | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!freelancerId || !user) return;

    const collector = new ActivityCollector();
    collectorRef.current = collector;
    collector.start();

    async function reportPresence() {
      if (!collectorRef.current || !user) return;

      const signals = collectorRef.current.snapshot();
      try {
        const token = await user.getIdToken();
        await fetch('/api/presence', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ freelancerId, signals }),
        });
      } catch {
        // Silently fail — presence is best-effort
      }
    }

    // Report immediately on mount, then every 60s
    reportPresence();
    intervalRef.current = setInterval(reportPresence, REPORT_INTERVAL_MS);

    // Report on page unload (beacon API for reliability)
    function handleUnload() {
      if (!collectorRef.current || !user) return;
      const signals = collectorRef.current.snapshot();
      // Use sendBeacon for reliability on page close
      const payload = JSON.stringify({ freelancerId, signals });
      navigator.sendBeacon('/api/presence', payload);
    }

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      collector.stop();
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [freelancerId, user]);
}
