'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, RefreshCw, CheckCircle2, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { workspaceBriefing } from '@/ai/flows/workspace-briefing';
import { getLatestBriefing, listBriefings } from '@/services/hub/briefings';
import type { AIBriefing } from '@/types/hub';
import { Timestamp } from 'firebase/firestore';

interface AiBriefingPanelProps {
  freelancerId: string;
  workspaceId: string;
}

function formatDate(ts: Timestamp): string {
  return ts.toDate().toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function AiBriefingPanel({ freelancerId, workspaceId }: AiBriefingPanelProps) {
  const [briefing, setBriefing] = useState<AIBriefing | null>(null);
  const [history, setHistory] = useState<AIBriefing[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [periodStart, setPeriodStart] = useState(toDateInputValue(sevenDaysAgo));
  const [periodEnd, setPeriodEnd] = useState(toDateInputValue(new Date()));

  async function fetchLatest() {
    setLoading(true);
    try {
      const latest = await getLatestBriefing(freelancerId, workspaceId);
      setBriefing(latest);
    } finally {
      setLoading(false);
    }
  }

  async function fetchHistory() {
    const all = await listBriefings(freelancerId, workspaceId, 10);
    setHistory(all);
  }

  useEffect(() => {
    fetchLatest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freelancerId, workspaceId]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      await workspaceBriefing({
        workspaceId,
        freelancerId,
        periodStart: new Date(periodStart).toISOString(),
        periodEnd: new Date(periodEnd + 'T23:59:59').toISOString(),
      });
      await fetchLatest();
      if (historyOpen) await fetchHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate briefing');
    } finally {
      setGenerating(false);
    }
  }

  async function handleToggleHistory() {
    if (!historyOpen && history.length === 0) {
      await fetchHistory();
    }
    setHistoryOpen((prev) => !prev);
  }

  return (
    <Card className="bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-base font-semibold">AI Briefing</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <label htmlFor="period-start" className="sr-only">Period start</label>
              <input
                id="period-start"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="border rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span>to</span>
              <label htmlFor="period-end" className="sr-only">Period end</label>
              <input
                id="period-end"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="border rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              )}
              {generating ? 'Generating...' : 'Generate Briefing'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !briefing ? (
          <div className="text-sm text-muted-foreground text-center py-10">
            No briefing yet. Generate one above to get started.
          </div>
        ) : (
          <div className="space-y-5">
            {/* Header meta */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                Generated {formatDate(briefing.generatedAt)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDate(briefing.periodStart)} – {formatDate(briefing.periodEnd)}
              </span>
            </div>

            {/* Summary */}
            <div>
              <h3 className="text-sm font-semibold mb-1.5">Summary</h3>
              <p className="text-sm text-foreground leading-relaxed">{briefing.summary}</p>
            </div>

            {/* Action Items */}
            {briefing.actionItems.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Action Items</h3>
                <ol className="space-y-1.5">
                  {briefing.actionItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="flex-1">{item}</span>
                      <CheckCircle2 className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5" />
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Blockers */}
            {briefing.blockers.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Blockers & Risks</h3>
                <ul className="space-y-1.5">
                  {briefing.blockers.map((blocker, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900"
                    >
                      <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <span>{blocker}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* History section */}
        <div className="border-t pt-3">
          <button
            onClick={handleToggleHistory}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-full text-left"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${historyOpen ? 'rotate-180' : ''}`}
            />
            Briefing history
          </button>

          {historyOpen && (
            <div className="mt-3 space-y-2">
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No past briefings.</p>
              ) : (
                history.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-md border bg-gray-50 px-3 py-2.5 space-y-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {formatDate(b.generatedAt)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {b.actionItems.length} actions · {b.blockers.length} blockers
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {b.summary}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
