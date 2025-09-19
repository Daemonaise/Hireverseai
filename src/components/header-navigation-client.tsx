
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react'; // Ensured UserPlus is imported
import { AuthPromptDialog } from '@/components/auth-prompt-dialog';

// Placeholder for actual authentication check
const checkAuthentication = (): { isAuthenticated: boolean; userId: string | null } => {
  console.log("Simulating authentication check...");
  // For testing, we now assume the user is always authenticated to bypass the dialog.
  const isAuthenticated = true;
  const userId = isAuthenticated ? 'test-user-id' : null;
  console.log("Auth Check Result:", { isAuthenticated, userId });
  return { isAuthenticated, userId };
};

export function HeaderNavigationClient() {
  const router = useRouter();
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);

  const handleClientPortalClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const { isAuthenticated } = checkAuthentication();

    if (isAuthenticated) {
      // Directly navigate to the dashboard since auth is bypassed.
      router.push('/client/dashboard');
    } else {
      // This part is now less likely to be triggered, but kept for logical completeness.
      setIsAuthDialogOpen(true);
    }
  };

  return (
    <>
      <nav className="flex items-center gap-2 md:gap-4"> {/* Adjusted gap for responsiveness */}
        <Button variant="outline" size="sm" asChild>
          <Link href="/community">Community</Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClientPortalClick}
        >
          Client Portal
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/freelancer/login">
            Freelancer Login
          </Link>
        </Button>
        <Button variant="default" size="sm" asChild>
           <Link href="/freelancer/signup" className="flex items-center gap-1.5"> {/* Added gap */}
                 <UserPlus className="h-4 w-4" />
                 <span className="hidden sm:inline">Freelancer </span>Signup {/* Hide 'Freelancer' on smaller screens */}
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
