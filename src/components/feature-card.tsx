
import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image'; // Import next/image
import { Badge } from '@/components/ui/badge'; // Import Badge

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  integrationLogos?: boolean; // Optional prop for integration logos
  isNew?: boolean; // Optional prop to mark feature as new
}

// Example SVG logos (replace with actual logos if available)
// Removed MondayLogo and TeamsLogo components as they are no longer rendered

export function FeatureCard({ icon, title, description, integrationLogos = false, isNew = false }: FeatureCardProps) {
  return (
    <Card className="flex flex-col h-full shadow-md hover:shadow-lg transition-shadow duration-300 rounded-lg overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2"> {/* Use justify-between */}
        <div className="flex items-center gap-4"> {/* Group icon and title */}
            {icon}
            <CardTitle className="text-lg font-semibold">{title}</CardTitle>
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
        {/* {integrationLogos && (
          <div className="mt-4 flex items-center space-x-4">
            <MondayLogo />
            <TeamsLogo />
            {/* Add more logos as needed * / }
          </div>
        )} */}
      </CardContent>
    </Card>
  );
}
