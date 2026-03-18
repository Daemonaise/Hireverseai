'use client';

import { Search, Bell, Globe } from 'lucide-react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ToolbarTabstrip, type TabDef } from './toolbar-tabstrip';

interface ToolbarProps {
  title: string;
  tabs?: TabDef[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
}

export function Toolbar({ title, tabs, activeTab, onTabChange }: ToolbarProps) {
  const locale = useLocale();
  const router = useRouter();

  function switchLocale(newLocale: string) {
    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000`;
    router.refresh();
  }

  return (
    <div className="h-12 bg-chrome border-b border-chrome-border flex items-center px-4 shrink-0">
      <div className="text-sm font-semibold text-chrome-foreground mr-4 shrink-0">
        {title}
      </div>

      {tabs && activeTab && onTabChange ? (
        <div className="flex-1 h-full flex items-center overflow-x-auto">
          <ToolbarTabstrip
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={onTabChange}
          />
        </div>
      ) : (
        <div className="flex-1" />
      )}

      <div className="flex items-center gap-1 shrink-0 ml-4">
        <button className="p-2 text-chrome-foreground/60 hover:text-chrome-foreground transition-colors rounded-md hover:bg-chrome-muted">
          <Search className="h-4 w-4" />
        </button>

        <button className="p-2 text-chrome-foreground/60 hover:text-chrome-foreground transition-colors rounded-md hover:bg-chrome-muted relative">
          <Bell className="h-4 w-4" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-2 text-chrome-foreground/60 hover:text-chrome-foreground transition-colors rounded-md hover:bg-chrome-muted">
              <Globe className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(['en', 'es', 'ru'] as const).map((loc) => (
              <DropdownMenuItem
                key={loc}
                onClick={() => switchLocale(loc)}
                className={locale === loc ? 'font-semibold' : ''}
              >
                {{ en: 'English', es: 'Español', ru: 'Русский' }[loc]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
