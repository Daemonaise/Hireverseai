'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { Workspace } from '@/types/hub';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Timestamp } from 'firebase/firestore';
import { useActivityEvents } from '@/hooks/hub/use-activity';
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
  const t = useTranslations('hub');

  const { data: unreadActivity = [] } = useActivityEvents(freelancerId, workspace.id, {
    since: workspace.lastVisitedAt?.toDate() ?? undefined,
    limit: 100,
  });
  const { data: deadlineActivity = [] } = useActivityEvents(freelancerId, workspace.id, {
    limit: 50,
  });

  const unreadCount = unreadActivity.length;
  const nextDeadline = deadlineActivity
    .filter((e) => e.dueDate)
    .sort((a, b) => a.dueDate!.toMillis() - b.dueDate!.toMillis())
    .find((e) => e.dueDate!.toDate() > new Date())?.dueDate ?? null;

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
            {workspace.status === 'active' ? t('active') : t('archived')}
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
            {t('nextDeadline')}: {nextDeadline.toDate().toLocaleDateString()}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          Updated {formatRelativeTime(workspace.updatedAt)}
        </p>
      </CardContent>
    </Card>
  );
}
