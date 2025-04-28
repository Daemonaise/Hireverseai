
'use client';

import { useState, useTransition, useCallback } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Loader2, CheckCircle, AlertCircle, Send, Eye, EyeOff, QrCode, UserPlus, CreditCard } from 'lucide-react'; // Added CreditCard and AlertCircle
import { useRouter } from 'next/navigation';           // ← Make sure this line is present
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { addClient, storeUserMfaSecret, generateMfaSecret } from '@/services/firestore'; // Import client-specific and MFA functions
import { Separator } from '@/components/ui/separator';
import { MfaSetup } from '@/components/mfa-setup'; // Import MFA setup component

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
  const [isPending, startTransition] = useTransition();
  const [isProcessing, setIsProcessing] = useState(false); // Combined loading state
  const [currentStep, setCurrentStep] = useState<'signup' | 'mfa' | 'processing_payment' | 'complete'>('signup');
  const [signupError, setSignupError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientEmail, setClientEmail] = useState<string | null>(null); // Store email for MFA URI
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null); // Store generated MFA secret
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
    // Do not reset step here, keep it on 'signup' until success
    // setCurrentStep('signup');
    setIsProcessing(true); // Start processing

    startTransition(async () => {
      try {
        // --- TODO: Implement Real Client Authentication & Account Creation ---
        console.log("Simulating client account creation for:", values.email);
        // Example: const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
        // const newUserId = userCredential.user.uid;
        const newUserId = `client_${Date.now()}`; // Placeholder ID generation
        // --- End Placeholder ---

        // Add client to Firestore
        const newClientId = await addClient({ id: newUserId, name: values.name, email: values.email });

        // Generate and store MFA secret
        const secret = generateMfaSecret();
        await storeUserMfaSecret(newClientId, secret, 'client');

        setClientId(newClientId);
        setClientEmail(values.email); // Store email for QR code
        setMfaSecret(secret); // Store secret for MfaSetup component

        // Proceed to MFA Setup step
        setCurrentStep('mfa');
        toast({
          title: 'Account Created',
          description: 'Please set up Multi-Factor Authentication.',
          variant: 'default',
        });

      } catch (err: any) {
        console.error('Error during client signup:', err);
        const errorMessage = err.message || 'An unexpected error occurred. Please try again.';
        setSignupError(errorMessage);
        // toast({ title: 'Signup Error', description: errorMessage, variant: 'destructive' }); // Toast can be redundant
        setCurrentStep('signup'); // Stay on signup step on error
      } finally {
        setIsProcessing(false); // End processing
      }
    });
  }, [toast]); // Added toast dependency

  // Callback when MFA is successfully verified and enabled
  const handleMfaVerified = useCallback(async () => {
    if (!clientId) {
        setSignupError("Client ID missing after MFA verification.");
        toast({ title: 'Error', description: 'Could not proceed to payment setup.', variant: 'destructive'});
        setCurrentStep('signup'); // Go back to signup on critical error
        return;
    }

    setCurrentStep('processing_payment'); // Show loading state for payment setup
    setIsProcessing(true);
    setSignupError(null);

    try {
        // *** Start Stripe Checkout Session Creation ***
        console.log(`MFA verified for ${clientId}. Creating Stripe subscription session...`);
        const checkoutResponse = await fetch('/api/stripe/create-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: clientId }), // Pass client ID
        });

        if (!checkoutResponse.ok) {
          const errorData = await checkoutResponse.json();
          throw new Error(errorData.error || 'Failed to create subscription session.');
        }

        const session = await checkoutResponse.json();
        if (session.url) {
          // Redirect to Stripe Checkout
          console.log("Redirecting to Stripe Checkout...");
          window.location.href = session.url;
          // User will be redirected back by Stripe. No 'complete' step needed here.
        } else {
          throw new Error('Could not get Stripe Checkout session URL.');
        }
    } catch (err: any) {
        console.error('Error creating Stripe session after MFA:', err);
        const errorMessage = err.message || 'Failed to set up subscription. Please try again or contact support.';
        setSignupError(errorMessage);
        toast({ title: 'Payment Setup Error', description: errorMessage, variant: 'destructive' });
        setCurrentStep('mfa'); // Allow user to potentially retry from MFA step or see error
        setIsProcessing(false);
    }
    // Note:setIsProcessing(false) might not be reached if redirection happens.
    // The 'processing_payment' state is mainly for feedback before redirection.

  }, [clientId, toast]); // Added dependencies

  // --- Conditional Rendering ---

   if (currentStep === 'mfa' && clientId && clientEmail && mfaSecret) {
     return <MfaSetup
              userId={clientId}
              userEmail={clientEmail}
              userType="client"
              mfaSecret={mfaSecret}
              onVerified={handleMfaVerified}
              // Handle MFA setup errors displayed within MfaSetup
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
             {/* Display Signup Error Alert within CardContent */}
             {signupError && currentStep === 'signup' && (
                <Alert variant="destructive" className="w-full">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Signup Error</AlertTitle>
                    <AlertDescription>{signupError}</AlertDescription>
                </Alert>
             )}
             <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Company Name / Full Name</FormLabel><FormControl><Input placeholder="e.g., Acme Corp or John Smith" {...field} disabled={isProcessing} /></FormControl><FormMessage /></FormItem> )} />
             <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Business Email</FormLabel><FormControl><Input type="email" placeholder="e.g., john.smith@company.com" {...field} disabled={isProcessing} /></FormControl><FormMessage /></FormItem> )} />
             <FormField control={form.control} name="password" render={({ field }) => ( <FormItem><FormLabel>Password</FormLabel><FormControl><div className="relative"><Input type={showPassword ? "text" : "password"} placeholder="Create a password" {...field} disabled={isProcessing} /><Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowPassword((prev) => !prev)} tabIndex={-1} disabled={isProcessing}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}<span className="sr-only">{showPassword ? "Hide password" : "Show password"}</span></Button></div></FormControl><p className="text-xs text-muted-foreground pt-1">Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char.</p><FormMessage /></FormItem> )} />
             <FormField control={form.control} name="confirmPassword" render={({ field }) => ( <FormItem><FormLabel>Confirm Password</FormLabel><FormControl><div className="relative"><Input type={showConfirmPassword ? "text" : "password"} placeholder="Confirm your password" {...field} disabled={isProcessing}/><Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowConfirmPassword((prev) => !prev)} tabIndex={-1} disabled={isProcessing}>{showConfirmPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}<span className="sr-only">{showConfirmPassword ? "Hide password" : "Show password"}</span></Button></div></FormControl><FormMessage /></FormItem> )} />
             <Separator />
              <div className="text-center text-sm text-muted-foreground space-y-1">
                  <p>You'll set up security (MFA) on the next step.</p>
                  <p>Includes a <strong>$20/month</strong> subscription, payable after setup.</p>
             </div>
           </CardContent>
           <CardFooter className="flex flex-col items-center gap-4">
             <Button type="submit" disabled={isPending || isProcessing || !form.formState.isValid} className="w-full">
               {isPending || isProcessing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> : <><UserPlus className="mr-2 h-4 w-4" />Create Account & Set Up MFA</>}
             </Button>
           </CardFooter>
         </form>
       </Form>
     </Card>
   );
}
