'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  Folders,
  Briefcase,
  MessageSquare,
  Sparkles,
  Settings,
  Plus,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { signOutUser } from '@/services/firestore';
import { WebdockSpaceIcon } from './webdock-space-icon';
import { WebdockGroupIcon } from './webdock-group-icon';
import { WebdockDivider } from './webdock-divider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';

type SpaceId = 'home' | 'workspaces' | 'projects' | 'messages' | 'ai';

interface WebdockProps {
  role: 'freelancer' | 'client';
  groups?: Array<{
    id: string;
    label: string;
    unreadCount?: number;
    href: string;
  }>;
  onCreateGroup?: () => void;
}

const FREELANCER_SPACES = [
  { id: 'home' as SpaceId, icon: LayoutGrid, label: 'Home', href: '/freelancer/hub' },
  { id: 'workspaces' as SpaceId, icon: Folders, label: 'Workspaces', href: '/freelancer/hub' },
  { id: 'messages' as SpaceId, icon: MessageSquare, label: 'Messages', href: '/freelancer/hub' },
  { id: 'ai' as SpaceId, icon: Sparkles, label: 'AI', href: '/freelancer/hub' },
];

const CLIENT_SPACES = [
  { id: 'home' as SpaceId, icon: LayoutGrid, label: 'Home', href: '/client/dashboard' },
  { id: 'projects' as SpaceId, icon: Briefcase, label: 'Projects', href: '/client/dashboard' },
  { id: 'messages' as SpaceId, icon: MessageSquare, label: 'Messages', href: '/client/dashboard' },
  { id: 'ai' as SpaceId, icon: Sparkles, label: 'AI Chat', href: '/client/dashboard' },
];

export function Webdock({ role, groups = [], onCreateGroup }: WebdockProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const spaces = role === 'freelancer' ? FREELANCER_SPACES : CLIENT_SPACES;

  const [activeSpace, setActiveSpace] = useState<SpaceId>('home');

  const activeGroupId = groups.find((g) => pathname.startsWith(g.href))?.id ?? null;

  return (
    <aside className="w-[60px] h-full bg-chrome flex flex-col items-center py-3 shrink-0">
      {/* Logo */}
      <Link href="/" className="mb-4">
        <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
          <span className="text-white font-bold text-xs">H</span>
        </div>
      </Link>

      {/* Space icons */}
      <div className="flex flex-col items-center gap-1.5">
        {spaces.map((space) => (
          <WebdockSpaceIcon
            key={space.id}
            icon={space.icon}
            label={space.label}
            active={activeSpace === space.id}
            onClick={() => setActiveSpace(space.id)}
          />
        ))}
      </div>

      <WebdockDivider />

      {/* Group icons */}
      <ScrollArea className="flex-1 w-full">
        <div className="flex flex-col items-center gap-1.5 px-[10px]">
          {groups.map((group) => (
            <Link key={group.id} href={group.href}>
              <WebdockGroupIcon
                label={group.label}
                active={activeGroupId === group.id}
                unreadCount={group.unreadCount}
              />
            </Link>
          ))}

          {onCreateGroup && (
            <button
              onClick={onCreateGroup}
              className="flex items-center justify-center w-10 h-10 rounded-lg border border-dashed border-chrome-border text-chrome-foreground/40 hover:text-chrome-foreground hover:border-chrome-foreground/40 transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>
      </ScrollArea>

      {/* Bottom controls */}
      <div className="flex flex-col items-center gap-2 mt-2">
        <button className="text-chrome-foreground/60 hover:text-chrome-foreground transition-colors">
          <Settings className="h-[18px] w-[18px]" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative">
              <div className="w-8 h-8 rounded-full bg-chrome-muted flex items-center justify-center text-xs font-semibold text-chrome-foreground">
                {user?.email?.[0]?.toUpperCase() ?? 'U'}
              </div>
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-accent-green border-2 border-chrome" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-48">
            <DropdownMenuItem className="text-xs text-muted-foreground" disabled>
              {user?.email}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => signOutUser()}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
