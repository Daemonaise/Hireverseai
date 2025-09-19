
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getTopFreelancers } from '@/services/firestore';
import type { Freelancer } from '@/types/freelancer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Award, Loader2, AlertCircle, Star } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const getInitials = (name: string) => {
  const names = name.split(' ');
  const initials = names.map((n) => n[0]).join('');
  return initials.length > 2 ? initials.substring(0, 2) : initials;
};

export function Leaderboard() {
  const [leaderboardData, setLeaderboardData] = useState<Freelancer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLeaderboard() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getTopFreelancers(10); // Fetch top 10
        setLeaderboardData(data);
      } catch (err) {
        console.error("Error fetching leaderboard:", err);
        setError("Failed to load leaderboard data. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchLeaderboard();
  }, []);

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-6 w-6 text-primary" />
          Community Leaderboard
        </CardTitle>
        <CardDescription>Top freelancers based on community contributions and performance.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading leaderboard...</span>
          </div>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!isLoading && !error && leaderboardData.length === 0 && (
          <p className="text-center text-muted-foreground py-4">The leaderboard is currently empty.</p>
        )}
        {!isLoading && !error && leaderboardData.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Rank</TableHead>
                <TableHead>Freelancer</TableHead>
                <TableHead className="text-center hidden sm:table-cell">Experience</TableHead>
                <TableHead className="text-center hidden sm:table-cell">Active</TableHead>
                <TableHead className="text-center hidden sm:table-cell">Rating</TableHead>
                <TableHead className="text-right">XP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaderboardData.map((freelancer, index) => (
                <TableRow key={freelancer.id}>
                  <TableCell className="font-medium text-lg text-muted-foreground">{index + 1}</TableCell>
                  <TableCell>
                    <Link href={`/freelancer/${freelancer.id}`} className="flex items-center gap-3 group">
                      <Avatar>
                        <AvatarFallback>{getInitials(freelancer.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium group-hover:underline">{freelancer.name}</p>
                        <p className="text-sm text-muted-foreground">{freelancer.skills[0] || 'Generalist'}</p>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="text-center hidden sm:table-cell">
                    <span className="font-medium">{freelancer.yearsOfExperience ?? 'N/A'} yrs</span>
                  </TableCell>
                  <TableCell className="text-center hidden sm:table-cell">
                    {freelancer.isLoggedIn && freelancer.status === 'available' && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>
                                    <div className="flex justify-center">
                                        <span className="block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-green-500/20" />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                <p>Online and Available</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                  </TableCell>
                  <TableCell className="text-center hidden sm:table-cell">
                    <div className="flex items-center justify-center gap-1">
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      <span className="font-medium">{freelancer.rating?.toFixed(1) ?? 'N/A'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-bold text-lg text-primary">{freelancer.xp ?? 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
