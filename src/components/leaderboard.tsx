'use client';

import { useEffect, useState } from 'react';
import { getTopFreelancers } from '@/services/firestore';
import type { Freelancer } from '@/types/freelancer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Award, Loader2, AlertCircle } from 'lucide-react'; // Added AlertCircle
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge'; // Import Badge component

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
                <TableHead>Name</TableHead>
                <TableHead className="text-right">XP</TableHead>
                {/* Optional: Add column for badges */}
                 {/* <TableHead>Badges</TableHead> */}
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaderboardData.map((freelancer, index) => (
                <TableRow key={freelancer.id}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell>{freelancer.name}</TableCell>
                  <TableCell className="text-right font-semibold">{freelancer.xp ?? 0}</TableCell>
                  {/* Optional: Display badges */}
                   {/* <TableCell>
                       {freelancer.badges?.map(badgeId => (
                           <Badge key={badgeId} variant="secondary" className="mr-1">{badgeId}</Badge> // Display badge IDs for now
                       ))}
                   </TableCell> */}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
