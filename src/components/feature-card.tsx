
import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils'; // Import cn

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  isNew?: boolean;
  tooltipText?: string;
  className?: string; // Allow passing additional classes
}

export function FeatureCard({ icon, title, description, isNew = false, tooltipText, className }: FeatureCardProps) {
  return (
    <Card className={cn("flex flex-col h-full shadow-md hover:shadow-lg transition-shadow duration-300 rounded-lg overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div className="flex items-center gap-3"> {/* Reduced gap for icon and title */}
            <div className="flex-shrink-0">{icon}</div> {/* Ensure icon doesn't shrink text */}
            <CardTitle className="text-lg font-semibold flex items-center gap-1 text-gray-900">
                {title}
                {tooltipText && (
                     <TooltipProvider>
                       <Tooltip>
                         <TooltipTrigger asChild>
                             <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                         </TooltipTrigger>
                         <TooltipContent side="top" align="start">
                           <p className="max-w-xs">{tooltipText}</p>
                         </TooltipContent>
                       </Tooltip>
                     </TooltipProvider>
                )}
            </CardTitle>
        </div>
         {isNew && (
            <Badge variant="destructive" className="text-xs whitespace-nowrap bg-green-500 text-white"> {/* Changed to green for NEW */}
                NEW
            </Badge>
        )}
      </CardHeader>
      <CardContent className="flex-1 pt-2">
        <CardDescription className="text-muted-foreground">{description}</CardDescription>
      </CardContent>
    </Card>
  );
}
