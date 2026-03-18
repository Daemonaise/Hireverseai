'use client';

import { useState, useTransition, useCallback } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Loader2, CheckCircle, AlertCircle, Send, Eye, EyeOff, QrCode, UserPlus, CreditCard } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
// Import real authentication and Firestore functions
import { createAuthUser, addClient, storeUserMfaSecret, generateMfaSecret, enableUserMfa } from '@/services/firestore';
import { Separator } from '@/components/ui/separator';
import { MfaSetup } from '@/components/mfa-setup';

const formSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid business email address.' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters.' })
   .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter.' })
   .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter.' })
   .regex(/[0-9]/, { message: 'Password must contain at least one number.' })
   .regex(/[^a-zA-Z0-9]/, { message: 'Password must contain at least one special character.' }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type FormSchema = z.infer<typeof formSchema>;

export function ClientSignupForm() {
  const [isPending, startTransition] = useTransition(); // isPending reflects the transition state
  const [isProcessing, setIsProcessing] = useState(false); // Generic loading state for async ops
  const [currentStep, setCurrentStep] = useState<'signup' | 'mfa' | 'processing_payment' | 'complete'>('signup');
  const [signupError, setSignupError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null); // Store the actual Client ID (from auth/firestore)
  const [clientEmail, setClientEmail] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
     mode: "onChange",
  });

  const handleSignupSubmit = useCallback(async (values: FormSchema) => {
    setSignupError(null);
    setClientId(null);
    setClientEmail(null);
    setMfaSecret(null);
    setIsProcessing(true); // Indicate processing starts

    startTransition(async () => {
      try {
        // 1. Create Authentication User (using placeholder, replace with real call)
        const authResult = await createAuthUser(values.email, values.password);
        if (!authResult || !authResult.userId) {
          // createAuthUser should throw, but handle null just in case
          throw new Error("Failed to create authentication account.");
        }
        const newUserId = authResult.userId; // This is the ID from the auth system

        // 2. Add client to Firestore using the Auth User ID
        // Pass the auth ID to addClient
        const newClientId = await addClient({ id: newUserId, name: values.name, email: values.email });

        // 3. Generate and store MFA secret in Firestore
        const secret = generateMfaSecret(); // Synchronous
        await storeUserMfaSecret(newClientId, secret, 'client');

        // Set state for the next step (MFA Setup)
        setClientId(newClientId); // Store the confirmed client ID
        setClientEmail(values.email);
        setMfaSecret(secret);

        // Transition to MFA setup step
        setCurrentStep('mfa');
        toast({
          title: 'Account Created',
          description: 'Please set up Multi-Factor Authentication.',
        });

      } catch (err: any) {
        const errorMessage = err.message || 'An unexpected error occurred during signup.';
        setSignupError(errorMessage);
        setCurrentStep('signup'); // Stay on signup step on error
      } finally {
        setIsProcessing(false); // End processing
      }
    });
  }, [toast]);

  // Callback when MFA is successfully verified and enabled (by MfaSetup)
  const handleMfaVerified = useCallback(async () => {
    if (!clientId) {
        const errorMsg = "Client ID missing after MFA verification. Cannot proceed to payment.";
        setSignupError(errorMsg);
        toast({ title: 'Error', description: 'Could not proceed to payment setup.', variant: 'destructive'});
        setCurrentStep('signup'); // Go back to signup on critical error
        return;
    }

    // Directly enable MFA in Firestore upon successful verification in MfaSetup
    try {
       await enableUserMfa(clientId, 'client');
    } catch (enableError: any) {
        // Decide how to handle this - maybe proceed but warn? For now, show error and stop.
        setSignupError(`MFA verified, but failed to save status: ${enableError.message}. Please contact support.`);
        toast({ title: 'MFA Error', description: 'Could not save MFA status.', variant: 'destructive'});
        setCurrentStep('mfa'); // Stay on MFA step if saving status fails
        return;
    }


    setCurrentStep('processing_payment');
    setIsProcessing(true);
    setSignupError(null);

    try {
        // Fetch the Stripe Checkout Session URL from your API route
        const checkoutResponse = await fetch('/api/stripe/create-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: clientId }), // Pass client ID to backend
        });

        if (!checkoutResponse.ok) {
          const errorData = await checkoutResponse.json();
          throw new Error(errorData.error || `Failed to create subscription session (Status: ${checkoutResponse.status}).`);
        }

        const session = await checkoutResponse.json();
        if (session.url) {
          // Redirect user to Stripe Checkout
          window.location.href = session.url;
          // Stripe handles the rest; user gets redirected back based on success/cancel URLs
        } else {
          throw new Error('Could not get Stripe Checkout session URL.');
        }
    } catch (err: any) {
        const errorMessage = err.message || 'Failed to set up subscription payment.';
        setSignupError(errorMessage);
        toast({ title: 'Payment Setup Error', description: errorMessage, variant: 'destructive' });
        setCurrentStep('mfa'); // Go back to MFA step on payment setup error
        setIsProcessing(false); // Stop processing indicator
    }
     // No 'complete' step needed here as Stripe redirects away

  }, [clientId, toast]);

  // --- Conditional Rendering ---

   if (currentStep === 'mfa' && clientId && clientEmail && mfaSecret) {
     return <MfaSetup
              userId={clientId}
              userEmail={clientEmail}
              userType="client"
              mfaSecret={mfaSecret}
              onVerified={handleMfaVerified}
              onCancel={() => {
                setSignupError(null); // Clear errors when cancelling MFA
                setCurrentStep('signup');
              }}
            />;
   }

   if (currentStep === 'processing_payment') {
        return (
           <Card className="w-full max-w-lg shadow-lg">
                <CardHeader className="text-center">
                    <CardTitle>Setting Up Subscription...</CardTitle>
                    <CardDescription>Please wait while we redirect you to our secure payment provider.</CardDescription>
                </CardHeader>
               <CardContent className="text-center py-10">
                    <Loader2 className="h-12 w-12 text-primary mx-auto animate-spin" />
               </CardContent>
           </Card>
        );
   }

   // Complete step is usually handled by redirect from Stripe back to the dashboard
   // Could add a local 'complete' state if needed for UI feedback before redirect,
   // but Stripe success/cancel URLs are the primary mechanism.


  // Render Signup Form (Initial Step)
  return (
     <Card className="w-full max-w-lg shadow-lg">
       <CardHeader>
         <CardTitle>Client Signup</CardTitle>
         <CardDescription>Create your Hireverse AI client account.</CardDescription>
       </CardHeader>
       <Form {...form}>
         <form onSubmit={form.handleSubmit(handleSignupSubmit)}>
           <CardContent className="space-y-4">
             {/* Display Signup Error Alert */}
             {signupError && currentStep === 'signup' && (
                <Alert variant="destructive" className="w-full">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Signup Error</AlertTitle>
                    <AlertDescription>{signupError}</AlertDescription>
                </Alert>
             )}
             <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Company Name / Full Name</FormLabel><FormControl><Input placeholder="e.g., Acme Corp or John Smith" {...field} disabled={isProcessing || isPending} /></FormControl><FormMessage /></FormItem> )} />
             <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Business Email</FormLabel><FormControl><Input type="email" placeholder="e.g., john.smith@company.com" {...field} disabled={isProcessing || isPending} /></FormControl><FormMessage /></FormItem> )} />
             <FormField control={form.control} name="password" render={({ field }) => ( <FormItem><FormLabel>Password</FormLabel><FormControl><div className="relative"><Input type={showPassword ? "text" : "password"} placeholder="Create a password" {...field} disabled={isProcessing || isPending} /><Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowPassword((prev) => !prev)} tabIndex={-1} disabled={isProcessing || isPending}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}<span className="sr-only">{showPassword ? "Hide password" : "Show password"}</span></Button></div></FormControl><p className="text-xs text-muted-foreground pt-1">Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char.</p><FormMessage /></FormItem> )} />
             <FormField control={form.control} name="confirmPassword" render={({ field }) => ( <FormItem><FormLabel>Confirm Password</FormLabel><FormControl><div className="relative"><Input type={showConfirmPassword ? "text" : "password"} placeholder="Confirm your password" {...field} disabled={isProcessing || isPending}/><Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowConfirmPassword((prev) => !prev)} tabIndex={-1} disabled={isProcessing || isPending}>{showConfirmPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}<span className="sr-only">{showConfirmPassword ? "Hide password" : "Show password"}</span></Button></div></FormControl><FormMessage /></FormItem> )} />
             <Separator />
              <div className="text-center text-sm text-muted-foreground space-y-1">
                  <p>Multi-Factor Authentication (MFA) setup required next.</p>
                  <p>Includes a <strong>$20/month</strong> subscription, payable after MFA setup.</p>
             </div>
           </CardContent>
           <CardFooter className="flex flex-col items-center gap-4">
             <Button
                 type="submit"
                 disabled={isPending || isProcessing || !form.formState.isValid}
                 className="w-full"
                 aria-disabled={isPending || isProcessing || !form.formState.isValid}
              >
               {isPending || isProcessing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> : <><UserPlus className="mr-2 h-4 w-4" />Create Account & Set Up MFA</>}
             </Button>
             {!form.formState.isValid && currentStep === 'signup' && !isProcessing && (
                 <p className="text-xs text-destructive text-center">Please complete all fields correctly.</p>
             )}
           </CardFooter>
         </form>
       </Form>
     </Card>
   );
}
