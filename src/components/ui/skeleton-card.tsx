interface SkeletonCardProps {
  count?: number;
  className?: string;
}

const shimmerClass = 'bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-muted via-muted/60 to-muted';

function SingleCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div className={`h-5 w-2/3 rounded ${shimmerClass}`} />
      <div className="space-y-2">
        <div className={`h-3 w-full rounded ${shimmerClass}`} />
        <div className={`h-3 w-5/6 rounded ${shimmerClass}`} />
        <div className={`h-3 w-3/4 rounded ${shimmerClass}`} />
      </div>
      <div className={`h-4 w-1/3 rounded ${shimmerClass}`} />
    </div>
  );
}

export function SkeletonCard({ count = 1, className }: SkeletonCardProps) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, i) => (
        <SingleCard key={i} />
      ))}
    </div>
  );
}
