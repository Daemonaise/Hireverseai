
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';
import { AuthPromptDialog } from '@/components/auth-prompt-dialog'; // New component for auth prompt

// Placeholder for actual authentication check
// In a real app, this would likely use context or a hook
const checkAuthentication = (): { isAuthenticated: boolean; userId: string | null } => {
  // TODO: Replace with real authentication logic (e.g., check session, token)
  console.log("Simulating authentication check...");
  // For demo purposes, assume not authenticated by default
  const isAuthenticated = false;
  const userId = isAuthenticated ? 'test-user-id' : null;
  console.log("Auth Check Result:", { isAuthenticated, userId });
  return { isAuthenticated, userId };
};

export function HeaderNavigationClient() {
  const router = useRouter();
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);

  const handleClientPortalClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault(); // Prevent default link behavior initially
    const { isAuthenticated } = checkAuthentication();

    if (isAuthenticated) {
      router.push('/client/dashboard'); // Navigate if authenticated
    } else {
      setIsAuthDialogOpen(true); // Show auth prompt if not authenticated
    }
  };

  return (
    <>
 <nav className="flex items-center gap-4">
        {/* Button 2 */}
        <Button variant="outline" size="sm" asChild>
          <Link href="/community">Community</Link>
        </Button>
        {/* Button 3 - No asChild */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleClientPortalClick}
        >
          Client Portal
        </Button>
        {/* Button 4 */}
        <Button variant="outline" size="sm" asChild>
          <Link href="/freelancer/login">
            Freelancer Login
          </Link>
        </Button>
        {/* Button 5 - Ensure Link is the only direct child */}
        <Button variant="default" size="sm" asChild>
           <Link href="/freelancer/signup" className="flex items-center">
                 <UserPlus className="h-4 w-4" />
                 Freelancer Signup
           </Link>
        </Button>
      </nav>

      {/* Authentication Prompt Dialog */}
      <AuthPromptDialog
        open={isAuthDialogOpen}
        onOpenChange={setIsAuthDialogOpen}
      />
    </>
  );
}
