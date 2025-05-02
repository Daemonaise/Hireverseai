'use client';

import { useState, useTransition, useCallback } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Loader2, LogIn, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MfaVerify } from '@/components/mfa-verify';
// Import real authentication functions and MFA check
import { signInAuthUser, isUserMfaEnabled } from '@/services/firestore';

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid business email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

type FormSchema = z.infer<typeof formSchema>;

export function ClientLoginForm() {
  const [isPending, startTransition] = useTransition();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');
  const [userIdForMfa, setUserIdForMfa] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();

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
          // signInAuthUser should throw specific errors, but handle null case just in case
          throw new Error("Invalid email or password.");
        }
        const userId = loginResult.userId;

        // 2. Check if MFA is enabled for this client
        const mfaEnabled = await isUserMfaEnabled(userId, 'client');
        console.log(`MFA enabled check for client ${userId}: ${mfaEnabled}`);

        if (mfaEnabled) {
          // Proceed to MFA step
          setUserIdForMfa(userId);
          setStep('mfa');
          toast({ title: 'Enter Verification Code', description: 'Please enter the code from your authenticator app.' });
        } else {
          // MFA not enabled, complete login directly
          completeLogin(userId);
        }

      } catch (error: any) {
        console.error('Client Login failed:', error);
        // Use the error message thrown by signInAuthUser or isUserMfaEnabled
        const errorMessage = error.message || 'Login failed. Please check your credentials or contact support.';
        setLoginError(errorMessage);
        setStep('credentials'); // Stay on credentials step
      }
    });
  }, [toast]);

  // Function to complete login after password/MFA success
  const completeLogin = useCallback((userId: string) => {
    toast({
      title: 'Login Successful',
      description: 'Redirecting to your dashboard...',
      variant: 'default',
    });
    // Redirect to the client dashboard, passing ID (consider session management instead for production)
    router.push(`/client/dashboard?clientId=${userId}`);
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
             userType="client"
             onVerified={handleMfaVerified}
             onCancel={handleMfaCancel}
             // Handle case where MFA is required but not fully set up (e.g., secret missing)
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
        <CardTitle>Client Login</CardTitle>
        <CardDescription>Access your project dashboard</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handlePasswordSubmit)}>
          <CardContent className="space-y-4">
            {/* Display Login Error Alert within CardContent */}
            {loginError && step === 'credentials' && (
                <Alert variant="destructive" className="w-full">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Login Error</AlertTitle>
                    <AlertDescription>{loginError}</AlertDescription>
                </Alert>
            )}
            <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Business Email</FormLabel><FormControl><Input type="email" placeholder="you@company.com" {...field} disabled={isPending} /></FormControl><FormMessage /></FormItem> )} />
            <FormField control={form.control} name="password" render={({ field }) => ( <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} disabled={isPending} /></FormControl><FormMessage /></FormItem> )} />
          </CardContent>
          <CardFooter className="flex flex-col items-center gap-4">
            <Button type="submit" disabled={isPending || !form.formState.isValid} className="w-full">
              {isPending ? ( <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Logging In...</> ) : ( <><LogIn className="mr-2 h-4 w-4" />Login</> )}
            </Button>
            {/* Optional: Add forgot password link */}
            {/* <Button variant="link" size="sm" className="mt-2 text-muted-foreground"> Forgot Password? </Button> */}
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
