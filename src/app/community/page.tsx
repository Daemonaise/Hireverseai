'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SiteLogo } from '@/components/site-logo';
import { HeaderNavigationClient } from '@/components/header-navigation-client';
import { LeaderboardTab } from '@/components/community/leaderboard-tab';
import { ForumsTab } from '@/components/community/forums-tab';
import { ShowcaseTab } from '@/components/community/showcase-tab';
import { ActivityTab } from '@/components/community/activity-tab';
import { PostDetail } from '@/components/community/post-detail';

type Tab = 'leaderboard' | 'forums' | 'showcase' | 'activity';

const TABS: { value: Tab; label: string }[] = [
  { value: 'leaderboard', label: 'Leaderboard' },
  { value: 'forums', label: 'Forums' },
  { value: 'showcase', label: 'Showcase' },
  { value: 'activity', label: 'Activity' },
];

export default function CommunityPage() {
  const [tab, setTab] = useState<Tab>('leaderboard');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const handleSelectPost = (postId: string) => setSelectedPostId(postId);
  const handleBack = () => setSelectedPostId(null);

  return (
    <div className="dark flex min-h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <Link href="/">
            <SiteLogo variant="dark" className="h-9 w-auto" />
          </Link>
          <HeaderNavigationClient />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 bg-white text-gray-900">
        <div className="container mx-auto px-4 md:px-6 py-8">
          <h1 className="text-3xl font-bold mb-6">Community</h1>

          {/* Tabs */}
          {!selectedPostId && (
            <div className="flex gap-1 mb-6 border-b border-gray-200">
              {TABS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTab(t.value)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    tab === t.value
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {/* Tab content or post detail */}
          {selectedPostId ? (
            <PostDetail postId={selectedPostId} onBack={handleBack} />
          ) : (
            <>
              {tab === 'leaderboard' && <LeaderboardTab />}
              {tab === 'forums' && <ForumsTab onSelectPost={handleSelectPost} />}
              {tab === 'showcase' && <ShowcaseTab onSelectPost={handleSelectPost} />}
              {tab === 'activity' && <ActivityTab />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
