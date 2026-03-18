'use client';

import { StarRating } from './star-rating';

interface ReviewSummaryProps {
  average: number;
  count: number;
  categoryAverages: {
    quality: number;
    communication: number;
    timeliness: number;
    expertise: number;
  };
}

export function ReviewSummary({ average, count, categoryAverages }: ReviewSummaryProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-4xl font-bold">{average.toFixed(1)}</span>
        <div>
          <StarRating value={Math.round(average)} readonly size="md" />
          <p className="text-sm text-muted-foreground mt-0.5">{count} review{count !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="space-y-2">
        {(['quality', 'communication', 'timeliness', 'expertise'] as const).map((key) => (
          <div key={key} className="flex items-center gap-3">
            <span className="text-xs w-24 capitalize text-muted-foreground">{key}</span>
            <div className="flex-1 h-2 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${(categoryAverages[key] / 5) * 100}%` }}
              />
            </div>
            <span className="text-xs w-6 text-right">{categoryAverages[key].toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
