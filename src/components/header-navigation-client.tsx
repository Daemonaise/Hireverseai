
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';
import { AuthPromptDialog } from '@/components/auth-prompt-dialog';

export function HeaderNavigationClient() {
  const router = useRouter();
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);

  const handleClientPortalClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    router.push('/client/dashboard');
  };

  return (
    <>
      <nav className="flex items-center gap-2 md:gap-3">
        <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
          <Link href="/community">Community</Link>
        </Button>
        <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
          <Link href="/freelancer/hub">Hub</Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClientPortalClick}
        >
          Client Portal
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/freelancer/login">Freelancer Login</Link>
        </Button>
        <Button variant="default" size="sm" asChild>
          <Link href="/freelancer/signup" className="flex items-center gap-1.5">
            <UserPlus className="h-4 w-4" />
            Sign Up
          </Link>
        </Button>
      </nav>

      <AuthPromptDialog
        open={isAuthDialogOpen}
        onOpenChange={setIsAuthDialogOpen}
      />
    </>
  );
}
