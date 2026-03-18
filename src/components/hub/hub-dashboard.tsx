'use client';

import { useState } from 'react';
import { Plus, Loader2, FolderOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useWorkspaces, useWorkspaceMutations } from '@/hooks/hub/use-workspace';
import { WorkspaceCard } from '@/components/hub/workspace-card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageTransition } from '@/components/motion/page-transition';
import { AnimateList } from '@/components/motion/animate-list';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { EmptyState } from '@/components/ui/empty-state';

interface HubDashboardProps {
  freelancerId: string;
}

export function HubDashboard({ freelancerId }: HubDashboardProps) {
  const { data: workspaces = [], isLoading: loading } = useWorkspaces(freelancerId);
  const { create } = useWorkspaceMutations(freelancerId);
  const t = useTranslations('hub');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [engagementType, setEngagementType] = useState('');

  function openDialog() {
    setName('');
    setClientName('');
    setEngagementType('');
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !clientName.trim()) return;
    setSubmitting(true);
    try {
      await create.mutateAsync({
        name: name.trim(),
        clientName: clientName.trim(),
        engagementType: engagementType.trim(),
        status: 'active',
      });
      setDialogOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <Button onClick={openDialog}>
            <Plus className="mr-2 h-4 w-4" />
            {t('newWorkspace')}
          </Button>
        </div>

        {loading ? (
          <SkeletonCard
            count={6}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          />
        ) : workspaces.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title={t('noWorkspaces')}
            description="Create a workspace to start managing your client engagements."
            action={{ label: t('newWorkspace'), onClick: openDialog }}
          />
        ) : (
          <AnimateList className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map((workspace) => (
              <WorkspaceCard key={workspace.id} workspace={workspace} freelancerId={freelancerId} />
            ))}
          </AnimateList>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('newWorkspace')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workspace-name">{t('workspaceName')}</Label>
                <Input
                  id="workspace-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Acme Corp – Q2 Retainer"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-name">{t('clientName')}</Label>
                <Input
                  id="client-name"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="engagement-type">{t('engagementType')}</Label>
                <Input
                  id="engagement-type"
                  value={engagementType}
                  onChange={(e) => setEngagementType(e.target.value)}
                  placeholder="e.g. retainer, contract, project"
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || !name.trim() || !clientName.trim()}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('createWorkspace')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  );
}
