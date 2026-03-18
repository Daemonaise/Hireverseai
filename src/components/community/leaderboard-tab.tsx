'use client';

import Link from 'next/link';
import { Star, Flame } from 'lucide-react';
import { useLeaderboard } from '@/hooks/use-community';

export function LeaderboardTab() {
  const { data: freelancers, isLoading } = useLeaderboard();

  if (isLoading) return <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-100 text-gray-500 text-xs uppercase">
          <tr>
            <th className="px-4 py-3 text-left w-12">#</th>
            <th className="px-4 py-3 text-left">Freelancer</th>
            <th className="px-4 py-3 text-left hidden md:table-cell">Level</th>
            <th className="px-4 py-3 text-left hidden md:table-cell">Skills</th>
            <th className="px-4 py-3 text-right">Rating</th>
            <th className="px-4 py-3 text-right">XP</th>
          </tr>
        </thead>
        <tbody>
          {freelancers?.map((f: any, i: number) => (
            <tr key={f.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-bold text-muted-foreground">{i + 1}</td>
              <td className="px-4 py-3">
                <Link href={`/freelancer/${f.id}`} className="font-medium hover:text-primary">
                  {f.name}
                </Link>
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                  Lv.{f.level ?? 1} {f.levelTitle ?? 'Newcomer'}
                </span>
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                <div className="flex flex-wrap gap-1">
                  {(f.skills ?? []).slice(0, 3).map((s: string) => (
                    <span key={s} className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">{s}</span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="flex items-center justify-end gap-1">
                  <Star className="h-3 w-3 fill-primary text-primary" />
                  {f.rating?.toFixed(1) ?? 'N/A'}
                </span>
              </td>
              <td className="px-4 py-3 text-right font-semibold">
                {(f.xp ?? 0).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
