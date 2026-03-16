'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Workspace } from '@/types/hub';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Timestamp } from 'firebase/firestore';
import { listActivityEvents } from '@/services/hub/activity';
import { Clock } from 'lucide-react';

interface WorkspaceCardProps {
  workspace: Workspace;
  freelancerId: string;
  onClick?: () => void;
}

function formatRelativeTime(value: Workspace['updatedAt']): string {
  if (!value || !(value instanceof Timestamp)) {
    return 'recently';
  }
  const date = value.toDate();
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

export function WorkspaceCard({ workspace, freelancerId, onClick }: WorkspaceCardProps) {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextDeadline, setNextDeadline] = useState<string | null>(null);

  useEffect(() => {
    async function fetchIndicators() {
      try {
        const since = workspace.lastVisitedAt?.toDate() ?? undefined;
        if (since) {
          const events = await listActivityEvents(freelancerId, workspace.id, { since, limit: 100 });
          setUnreadCount(events.length);
        }
        // Find nearest deadline
        const allEvents = await listActivityEvents(freelancerId, workspace.id, { limit: 50 });
        const now = new Date();
        const upcoming = allEvents
          .filter(e => e.dueDate && e.dueDate.toDate() > now)
          .sort((a, b) => a.dueDate!.toDate().getTime() - b.dueDate!.toDate().getTime());
        if (upcoming.length > 0) {
          setNextDeadline(upcoming[0].dueDate!.toDate().toLocaleDateString());
        }
      } catch {
        // Activity may not exist yet
      }
    }
    fetchIndicators();
  }, [freelancerId, workspace.id, workspace.lastVisitedAt]);

  function handleClick() {
    if (onClick) onClick();
    router.push(`/freelancer/hub/${workspace.id}`);
  }

  return (
    <Card
      className="rounded-xl border hover:-translate-y-0.5 transition-transform cursor-pointer"
      onClick={handleClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-base leading-tight">{workspace.name}</h3>
            {unreadCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-medium text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <Badge
            className={
              workspace.status === 'active'
                ? 'bg-green-100 text-green-800 hover:bg-green-100'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-100'
            }
          >
            {workspace.status === 'active' ? 'Active' : 'Archived'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{workspace.clientName}</span>
        </p>
        <p className="text-sm text-muted-foreground">{workspace.engagementType}</p>
        {nextDeadline && (
          <p className="flex items-center gap-1 text-xs text-amber-600">
            <Clock className="h-3 w-3" />
            Next deadline: {nextDeadline}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          Updated {formatRelativeTime(workspace.updatedAt)}
        </p>
      </CardContent>
    </Card>
  );
}
