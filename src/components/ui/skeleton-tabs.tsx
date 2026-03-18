interface SkeletonTabsProps {
  tabs?: number;
  className?: string;
}

const shimmerClass = 'bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-muted via-muted/60 to-muted';

const TAB_WIDTHS = [72, 88, 64, 96];

export function SkeletonTabs({ tabs = 4, className }: SkeletonTabsProps) {
  return (
    <div className={className}>
      <div className="flex gap-4 border-b border-border pb-2 mb-6">
        {Array.from({ length: tabs }, (_, i) => (
          <div
            key={i}
            className={`h-4 rounded ${shimmerClass}`}
            style={{ width: `${TAB_WIDTHS[i % TAB_WIDTHS.length]}px` }}
          />
        ))}
      </div>
      <div className="space-y-4">
        <div className={`h-5 w-1/3 rounded ${shimmerClass}`} />
        <div className={`h-32 w-full rounded-lg ${shimmerClass}`} />
      </div>
    </div>
  );
}
