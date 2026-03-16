'use client';

import { useEffect, useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import type { Workspace } from '@/types/hub';
import { listWorkspaces, createWorkspace } from '@/services/hub/workspaces';
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

interface HubDashboardProps {
  freelancerId: string;
}

export function HubDashboard({ freelancerId }: HubDashboardProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [engagementType, setEngagementType] = useState('');

  async function fetchWorkspaces() {
    setLoading(true);
    try {
      const data = await listWorkspaces(freelancerId);
      setWorkspaces(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchWorkspaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freelancerId]);

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
      await createWorkspace(freelancerId, {
        name: name.trim(),
        clientName: clientName.trim(),
        engagementType: engagementType.trim(),
        status: 'active',
      });
      setDialogOpen(false);
      await fetchWorkspaces();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Client Systems Hub</h1>
        <Button onClick={openDialog}>
          <Plus className="mr-2 h-4 w-4" />
          New Workspace
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : workspaces.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
          No workspaces yet. Create one to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map((workspace) => (
            <WorkspaceCard key={workspace.id} workspace={workspace} />
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Workspace</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="workspace-name">Workspace Name</Label>
              <Input
                id="workspace-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Corp – Q2 Retainer"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-name">Client Name</Label>
              <Input
                id="client-name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Acme Corp"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="engagement-type">Engagement Type</Label>
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
                Create Workspace
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
