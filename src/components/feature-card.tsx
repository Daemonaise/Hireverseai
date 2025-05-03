
import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image'; // Keep import if used elsewhere
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from 'lucide-react'; // Add Info icon for tooltip trigger

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  integrationLogos?: boolean; // Optional prop for integration logos
  isNew?: boolean; // Optional prop to mark feature as new
  tooltipText?: string; // Optional tooltip text for technical terms
}

export function FeatureCard({ icon, title, description, integrationLogos = false, isNew = false, tooltipText }: FeatureCardProps) {
  return (
    <Card className="flex flex-col h-full shadow-md hover:shadow-lg transition-shadow duration-300 rounded-lg overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2"> {/* Use justify-between */}
        <div className="flex items-center gap-4"> {/* Group icon and title */}
            {icon}
            <CardTitle className="text-lg font-semibold flex items-center gap-1">
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
            <Badge variant="destructive" className="text-xs whitespace-nowrap"> {/* Use a contrasting color for NEW */}
                NEW
            </Badge>
        )}
      </CardHeader>
      <CardContent className="flex-1 pt-2">
        <CardDescription>{description}</CardDescription>
        {/* Integration logos rendering logic removed */}
      </CardContent>
    </Card>
  );
}
