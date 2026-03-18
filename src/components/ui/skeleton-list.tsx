interface SkeletonListProps {
  rows?: number;
  className?: string;
}

const shimmerClass = 'bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-muted via-muted/60 to-muted';

function SingleRow() {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className={`h-9 w-9 rounded-full shrink-0 ${shimmerClass}`} />
      <div className="flex-1 space-y-1.5">
        <div className={`h-3.5 w-2/3 rounded ${shimmerClass}`} />
        <div className={`h-3 w-1/2 rounded ${shimmerClass}`} />
      </div>
    </div>
  );
}

export function SkeletonList({ rows = 5, className }: SkeletonListProps) {
  return (
    <div className={className}>
      {Array.from({ length: rows }, (_, i) => (
        <SingleRow key={i} />
      ))}
    </div>
  );
}
