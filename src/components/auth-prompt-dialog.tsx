
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button'; // Import Button

interface AuthPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthPromptDialog({ open, onOpenChange }: AuthPromptDialogProps) {
  const router = useRouter();

  const handleSignIn = () => {
    onOpenChange(false); // Close dialog
    router.push('/client/login'); // Navigate to sign in
  };

  const handleSignUp = () => {
    onOpenChange(false); // Close dialog
    router.push('/client/signup'); // Navigate to sign up
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Authentication Required</AlertDialogTitle>
          <AlertDialogDescription>
            Please sign in or create an account to access the client portal.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
           {/* Use standard Buttons instead of AlertDialogAction/Cancel for custom actions */}
           <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
           <Button variant="secondary" onClick={handleSignIn}>Sign In</Button>
           <Button onClick={handleSignUp}>Sign Up</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
