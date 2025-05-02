'use client';

import { useState, useTransition, useCallback } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Loader2, LogIn, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation'; // Import useRouter

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MfaVerify } from '@/components/mfa-verify';
// Import real authentication functions and MFA check
import { signInAuthUser, isUserMfaEnabled, updateFreelancerStatus } from '@/services/firestore';

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  // Adjusted minimum password length based on schema in signup form (min 8)
  password: z.string().min(8, { message: 'Password must be at least 8 characters.' }),
});

type FormSchema = z.infer<typeof formSchema>;

export function FreelancerLoginForm() {
  const [isPending, startTransition] = useTransition();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');
  const [userIdForMfa, setUserIdForMfa] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter(); // Initialize router

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const handlePasswordSubmit = useCallback(async (values: FormSchema) => {
    setLoginError(null);
    setUserIdForMfa(null);
    startTransition(async () => {
      try {
        // 1. Authenticate with password using the actual authentication service
        const loginResult = await signInAuthUser(values.email, values.password);

        if (!loginResult || !loginResult.userId) {
          // Handle potential null return, although signInAuthUser should throw
           throw new Error("Invalid email or password.");
        }
        const userId = loginResult.userId;

        // 2. Check if MFA is enabled for this freelancer
        const mfaEnabled = await isUserMfaEnabled(userId, 'freelancer');
        console.log(`MFA enabled check for freelancer ${userId}: ${mfaEnabled}`);

        if (mfaEnabled) {
          // Proceed to MFA step
          setUserIdForMfa(userId);
          setStep('mfa');
          toast({ title: 'Enter Verification Code', description: 'Please enter the code from your authenticator app.' });
        } else {
          // MFA not enabled, complete login directly
          await completeLogin(userId);
        }

      } catch (error: any) {
        console.error('Freelancer Login failed:', error);
        // Use error message from signInAuthUser or isUserMfaEnabled
        const errorMessage = error.message || 'Login failed. Please check your credentials or contact support.';
        setLoginError(errorMessage);
        setStep('credentials'); // Stay on credentials step
      }
    });
  }, [toast]);

  // Function to complete login after password/MFA success
  const completeLogin = useCallback(async (userId: string) => {
    try {
        // Update freelancer status to 'available' and isLoggedIn to true
        await updateFreelancerStatus(userId, 'available', true);
        console.log(`Freelancer ${userId} logged in and status updated to available.`);

        toast({
          title: 'Login Successful',
          description: 'Redirecting to your dashboard...',
        });
        // Redirect to the freelancer dashboard
        // Use router.push for Next.js navigation
        router.push(`/freelancer/dashboard?id=${userId}`);

    } catch (statusError: any) {
         console.error('Error updating freelancer status after login:', statusError);
         toast({
             title: 'Login Warning',
             description: 'Logged in, but failed to update your status. Please update manually in dashboard.',
             variant: 'destructive',
             duration: 7000,
         });
         // Still redirect even if status update fails
         router.push(`/freelancer/dashboard?id=${userId}`);
    }
  }, [toast, router]);

  // Callback when MFA is verified successfully
  const handleMfaVerified = useCallback(() => {
    if (userIdForMfa) {
      completeLogin(userIdForMfa);
    } else {
        console.error("MFA verified but userIdForMfa is null.");
        setLoginError("An unexpected error occurred after MFA verification.");
        setStep('credentials'); // Go back to credential step on error
    }
  }, [userIdForMfa, completeLogin]);

  // Go back from MFA step
  const handleMfaCancel = () => {
      setStep('credentials');
      setUserIdForMfa(null);
      setLoginError(null); // Clear previous errors
      form.reset(); // Clear password field
  };

  if (step === 'mfa' && userIdForMfa) {
      return <MfaVerify
               userId={userIdForMfa}
               userType="freelancer"
               onVerified={handleMfaVerified}
               onCancel={handleMfaCancel}
               // Handle MFA setup errors during login verification
               onInvalidCredentials={() => {
                  setLoginError("MFA setup incomplete or secret missing. Cannot log in. Please contact support.");
                  setStep('credentials');
               }}
            />;
  }

  // Render initial credentials form
  return (
    <Card className="w-full shadow-lg">
      <CardHeader className="text-center">
        <CardTitle>Freelancer Login</CardTitle>
        <CardDescription>Access your dashboard</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handlePasswordSubmit)}>
          <CardContent className="space-y-4">
             {/* Display Login Error Alert */}
             {loginError && step === 'credentials' && (
                <Alert variant="destructive" className="w-full">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Login Error</AlertTitle>
                    <AlertDescription>{loginError}</AlertDescription>
                </Alert>
             )}
            <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" placeholder="you@example.com" {...field} disabled={isPending} /></FormControl><FormMessage /></FormItem> )} />
            <FormField control={form.control} name="password" render={({ field }) => ( <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} disabled={isPending} /></FormControl><FormMessage /></FormItem> )} />
          </CardContent>
          <CardFooter className="flex flex-col items-center gap-4">
            <Button type="submit" disabled={isPending || !form.formState.isValid} className="w-full">
              {isPending ? ( <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Logging In...</> ) : ( <><LogIn className="mr-2 h-4 w-4" />Login</> )}
            </Button>
             {/* <Button variant="link" size="sm" className="mt-2 text-muted-foreground"> Forgot Password? </Button> */}
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
