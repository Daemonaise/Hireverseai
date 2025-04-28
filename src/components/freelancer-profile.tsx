'use client';

import { useEffect, useState } from 'react';
import type { Freelancer } from '@/types/freelancer';
import { BADGES, type Badge as BadgeType } from '@/types/badge'; // Import static badge definitions
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Star, CheckCircle, Loader2, AlertCircle } from 'lucide-react'; // Added AlertCircle
import { Badge } from '@/components/ui/badge'; // UI component
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from '@/components/ui/separator';
import { getFreelancerById } from '@/services/firestore'; // To fetch freelancer data
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface FreelancerProfileProps {
  freelancerId: string; // Pass the ID of the freelancer to display
}

export function FreelancerProfile({ freelancerId }: FreelancerProfileProps) {
  const [freelancer, setFreelancer] = useState<Freelancer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

   useEffect(() => {
    async function fetchFreelancer() {
      if (!freelancerId) {
          setError("No Freelancer ID provided.");
          setIsLoading(false);
          return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const data = await getFreelancerById(freelancerId);
        if (data) {
            setFreelancer(data);
        } else {
            setError(`Freelancer with ID ${freelancerId} not found.`);
        }
      } catch (err) {
        console.error("Error fetching freelancer profile:", err);
        setError("Failed to load freelancer profile. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchFreelancer();
  }, [freelancerId]);


  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading profile...</span>
      </div>
    );
  }

  if (error) {
    return (
       <Alert variant="destructive">
         <AlertCircle className="h-4 w-4" />
         <AlertTitle>Error</AlertTitle>
         <AlertDescription>{error}</AlertDescription>
       </Alert>
    );
  }

  if (!freelancer) {
      return <p className="text-center text-muted-foreground">Freelancer data not available.</p>;
  }


  const earnedBadges: BadgeType[] = (freelancer.badges ?? [])
      .map(badgeId => BADGES[badgeId])
      .filter(Boolean); // Filter out any undefined badges if IDs don't match


  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle>{freelancer.name}</CardTitle>
        <CardDescription>{freelancer.email}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
         {/* XP Section */}
         <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
             <div className="flex items-center gap-2">
                 <Star className="h-5 w-5 text-yellow-500" />
                 <span className="font-medium">Experience Points</span>
             </div>
             <span className="text-lg font-bold text-primary">{freelancer.xp ?? 0} XP</span>
         </div>

          {/* Badges Section */}
         {earnedBadges.length > 0 && (
             <div>
                 <h3 className="text-md font-semibold mb-2">Badges Earned</h3>
                  <Separator className="mb-3" />
                 <TooltipProvider>
                     <div className="flex flex-wrap gap-2">
                         {earnedBadges.map(badge => (
                             <Tooltip key={badge.id}>
                                 <TooltipTrigger>
                                     <Badge variant="secondary" className="cursor-default flex items-center gap-1">
                                         {/* You can add an icon here later if badge.iconUrl is defined */}
                                         {/* <img src={badge.iconUrl} alt="" className="h-4 w-4" /> */}
                                         <CheckCircle className="h-3 w-3 text-green-600" /> {/* Placeholder icon */}
                                         {badge.name}
                                     </Badge>
                                 </TooltipTrigger>
                                 <TooltipContent>
                                     <p>{badge.description}</p>
                                 </TooltipContent>
                             </Tooltip>
                         ))}
                     </div>
                 </TooltipProvider>
             </div>
         )}

         {/* Skills & Scores (Optional) */}
         {/* You could add another section here to display skills and test scores if desired */}

      </CardContent>
       <CardFooter>
           <p className="text-xs text-muted-foreground">Profile updated: {freelancer.updatedAt ? new Date(freelancer.updatedAt.seconds * 1000).toLocaleDateString() : 'N/A'}</p>
       </CardFooter>
    </Card>
  );
}
