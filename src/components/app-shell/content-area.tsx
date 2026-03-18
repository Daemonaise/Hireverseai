import { ScrollArea } from '@/components/ui/scroll-area';

interface ContentAreaProps {
  children: React.ReactNode;
  className?: string;
}

export function ContentArea({ children, className }: ContentAreaProps) {
  return (
    <ScrollArea className="flex-1">
      <div
        className={`bg-content-bg min-h-full shadow-[inset_0_1px_0_0_rgba(0,0,0,0.06)] ${className ?? 'p-6'}`}
      >
        {children}
      </div>
    </ScrollArea>
  );
}
