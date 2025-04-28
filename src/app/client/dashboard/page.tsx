'use client';

import { ClientDashboard } from '@/components/client-dashboard';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation'; // Import useSearchParams
import React, { useEffect } from 'react'; // Import React and useEffect
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast'; // Import toast
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Import Alert
import { AlertCircle, CheckCircle } from "lucide-react"; // Import icons

// TODO: Replace with actual authentication logic
const useAuthentication = () => {
     const searchParams = useSearchParams();
     // For demo, get ID from URL; replace with real auth context later
     const simulatedClientId = searchParams?.get('clientId') ?? searchParams?.get('id') ?? 'test-client-001';
     console.log("Simulated auth hook: using client ID -", simulatedClientId);
     const isAuthenticated = !!simulatedClientId;
     return { isAuthenticated, userId: simulatedClientId };
};

export function ClientDashboardLoader() {
     const { isAuthenticated, userId } = useAuthentication();
     const searchParams = useSearchParams();
     const { toast } = useToast();

     // Handle redirects from Stripe Checkout/Payment Intent
     useEffect(() => {
         const subscriptionStatus = searchParams?.get('subscription');
         const paymentIntentStatus = searchParams?.get('payment_intent_status');
         const projectId = searchParams?.get('project_id');

         if (subscriptionStatus === 'success') {
             toast({
                 title: 'Subscription Activated!',
                 description: 'Your Hireverse AI subscription is now active.',
                 variant: 'default', // Use 'success' variant if available
             });
             // TODO: Potentially trigger MFA setup here if needed after subscription
         } else if (subscriptionStatus === 'cancelled') {
             toast({
                 title: 'Subscription Cancelled',
                 description: 'Your subscription setup was cancelled. You can try again.',
                 variant: 'destructive',
             });
         }

          if (paymentIntentStatus === 'succeeded' && projectId) {
             toast({
                 title: 'Payment Successful!',
                 description: `Payment for project ${projectId} received. Work will begin shortly.`,
                 variant: 'default', // Use 'success' variant if available
             });
         }
         // Note: Failed payment intents usually redirect back to the checkout page
         // with an error message handled by Stripe Elements.

     }, [searchParams, toast]);


     if (!isAuthenticated || !userId) {
          return (
               <div className="flex flex-col items-center justify-center py-12">
                   <Alert variant="destructive" className="mb-4 max-w-md">
                       <AlertCircle className="h-4 w-4" />
                       <AlertTitle>Authentication Required</AlertTitle>
                       <AlertDescription>
                           You need to be logged in to view the dashboard.
                       </AlertDescription>
                   </Alert>
                    <Link href="/client/login">
                         <Button>Go to Client Login</Button>
                    </Link>
               </div>
          );
     }

     // Render the actual dashboard component, passing the authenticated client ID
     return <ClientDashboard clientId={userId} />;
}


// Main Page Component
export default function ClientDashboardPage() {
     return (
          <div className="flex min-h-screen flex-col">
               {/* Header */}
               <header className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6 sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
                    <Link href="/" aria-label="Hireverse AI Home" className="flex items-center gap-2">
                        <span className="text-xl font-bold text-foreground">Hireverse AI</span>
                    </Link>
                    <nav className="flex items-center gap-4">
                         {/* TODO: Implement actual logout functionality */}
                         <Button variant="outline" disabled> {/* Placeholder/disabled Logout */}
                           Logout
                         </Button>
                    </nav>
               </header>

               {/* Main Content */}
               <main className="flex-1 py-8 md:py-12">
                    <div className="container mx-auto px-4 md:px-6">
                         {/* Wrap the component using client hooks in Suspense */}
                         <React.Suspense fallback={
                               <div className="flex justify-center items-center py-12">
                                   <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                   <span className="ml-2 text-muted-foreground">Loading Dashboard...</span>
                               </div>
                           }>
                              <ClientDashboardLoader />
                         </React.Suspense>
                    </div>
               </main>

               {/* Footer */}
               <footer className="border-t bg-muted/40 py-6 mt-12">
                    <div className="container mx-auto flex flex-col items-center justify-between px-4 text-center text-sm text-muted-foreground md:flex-row md:px-6">
                        <p>&copy; {new Date().getFullYear()} Hireverse AI. All rights reserved.</p>
                    </div>
               </footer>
          </div>
     );
}
