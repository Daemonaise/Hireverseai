
'use client';

import { useState, useTransition, useCallback } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Loader2, LogIn, AlertCircle } from 'lucide-react'; // AlertCircle already imported

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MfaVerify } from '@/components/mfa-verify'; // Import MFA verification component
import { isUserMfaEnabled, updateFreelancerStatus } from '@/services/firestore'; // Import MFA check and status update

// TODO: Import actual authentication functions
// import { signInWithEmailAndPassword } from "firebase/auth";
// import { auth } from "@/lib/firebase";

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

type FormSchema = z.infer<typeof formSchema>;

// Simulate getting user ID after successful password auth (replace with real auth logic)
async function simulatePasswordLogin(email: string, password: string): Promise<{ userId: string } | null> {
    console.log("Simulating password check for:", email);
    // Replace with actual Firebase/auth provider login
    // const userCredential = await signInWithEmailAndPassword(auth, email, password);
    // return { userId: userCredential.user.uid };
    if (password === 'password') { // Basic placeholder check
        return { userId: `freelancer-${email.split('@')[0]}` };
    }
    return null;
}

export function FreelancerLoginForm() {
  const [isPending, startTransition] = useTransition();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');
  const [userIdForMfa, setUserIdForMfa] = useState<string | null>(null);
  const { toast } = useToast();

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
        // 1. Authenticate with password (using placeholder)
        const loginResult = await simulatePasswordLogin(values.email, values.password);

        if (!loginResult) {
            throw new Error("Invalid email or password.");
        }
        const userId = loginResult.userId;

        // 2. Check if MFA is enabled for this user
        const mfaEnabled = await isUserMfaEnabled(userId, 'freelancer');

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
        console.error('Password Login failed:', error);
        let errorMessage = 'Login failed. Please check your credentials.';
        if (error.message.includes("Invalid email or password")) {
          errorMessage = 'Invalid email or password.';
        } else if (error.message.includes("MFA check failed")) {
           errorMessage = 'MFA check failed. Please contact support.';
        }
        setLoginError(errorMessage);
        // toast({ title: 'Login Failed', description: errorMessage, variant: 'destructive' }); // Toast can be redundant
        setStep('credentials'); // Stay on credentials step
      }
    });
  }, [toast]); // Added toast dependency

  // Function to complete login after password/MFA success
  const completeLogin = useCallback(async (userId: string) => {
    try {
        // --- Update freelancer status in Firestore ---
        await updateFreelancerStatus(userId, 'available', true); // Set isLoggedIn = true, status = available
        console.log(`Freelancer ${userId} logged in and status updated.`);

        toast({
          title: 'Login Successful',
          description: 'Redirecting to your dashboard...',
          variant: 'default',
        });
        // Redirect to the freelancer dashboard
        window.location.href = `/freelancer/dashboard?id=${userId}`; // Use Next Router ideally

    } catch (statusError: any) {
         console.error('Error updating freelancer status after login:', statusError);
         toast({
             title: 'Login Warning',
             description: 'Logged in, but failed to update your status. Please update manually in dashboard.',
             variant: 'destructive', // Use destructive to highlight the issue
             duration: 7000,
         });
         // Still redirect even if status update fails
         window.location.href = `/freelancer/dashboard?id=${userId}`;
    }
  }, [toast]);

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
                  setLoginError("MFA setup incomplete or secret missing. Cannot log in.");
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
             {/* Display Login Error Alert within CardContent */}
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
