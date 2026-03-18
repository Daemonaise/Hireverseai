
'use client';

import React, { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react'; // Added AlertCircle
import { useToast } from '@/hooks/use-toast';
import { verifyMfaToken, getUserMfaSecret } from '@/services/firestore'; // Assuming these exist
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface MfaVerifyProps {
  userId: string;
  userType: 'client' | 'freelancer';
  onVerified: () => void; // Callback when successfully verified
  onInvalidCredentials?: () => void; // Optional: Callback if initial credentials were wrong (MFA shouldn't be shown)
  onCancel?: () => void; // Optional callback to go back
}

const formSchema = z.object({
  mfaCode: z.string().length(6, { message: 'Code must be 6 digits.' }).regex(/^\d{6}$/, { message: 'Code must contain only digits.' }),
});

type FormSchema = z.infer<typeof formSchema>;

export function MfaVerify({ userId, userType, onVerified, onInvalidCredentials, onCancel }: MfaVerifyProps) {
  const [isVerifying, startVerificationTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mfaSetupError, setMfaSetupError] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      mfaCode: '',
    },
    mode: 'onChange',
  });

  const handleVerify = async (values: FormSchema): Promise<void> => { // Explicitly return Promise<void>
    setError(null); // Clear any previous errors

    setMfaSetupError(null); // Clear setup errors
    startVerificationTransition(async () => {
      try {
        const secret = await getUserMfaSecret(userId, userType); // Fetch the user's stored MFA secret

        if (!secret) {
          const setupErrMsg = `MFA is required but not configured for your account. Please contact support or retry login.`;
          setMfaSetupError(setupErrMsg);
          onInvalidCredentials?.(); // Signal that MFA isn't set up correctly
          return;
        }

        const isValid = verifyMfaToken(secret, values.mfaCode); // Verify the provided token against the secret

        if (!isValid) {
          setError("Invalid verification code. Please try again."); // Error message for incorrect code
          form.resetField("mfaCode"); // Clear the input field
          return;
        }

        // Verification successful
        toast({
          title: 'Verification Successful',
          description: 'You are now logged in.',
          variant: 'default',
        });
        onVerified(); // Call the success callback

        // Redirect based on userType after verification
        // Note: onVerified might handle the redirection, adjust if needed.
        // if (userType === 'client') {
        //   router.push(`/client/dashboard?clientId=${userId}`);
        // } else if (userType === 'freelancer') {
        //   router.push(`/freelancer/dashboard?id=${userId}`);
        // }

      } catch (error: any) {
        let errorMessage = "An unexpected error occurred during verification. Please try again.";
        if (error.message.includes('Failed to fetch MFA secret')) {
            errorMessage = "Could not retrieve MFA setup. Please try logging in again or contact support.";
            setMfaSetupError(errorMessage); // Use the specific error state
        } else {
            setError(errorMessage); // General verification error
        }
        form.resetField('mfaCode'); // Clear the input field on error
      }
    });
  };

  // Optional effect to check MFA status on load if onInvalidCredentials callback exists
  React.useEffect(() => {
    const checkMfaStatus = async (): Promise<void> => { // Explicitly return Promise<void>
      try { // Use try...catch to handle potential errors during the async operation
        const secret = await getUserMfaSecret(userId, userType);
        if (!secret) {
          setMfaSetupError("MFA is required but not configured for your account. Please contact support.");
          onInvalidCredentials?.();
        }
      } catch (e) {
        setMfaSetupError("An unexpected error occurred while loading MFA information. Please try again.");
      }
    };

    if (onInvalidCredentials) {
      checkMfaStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, userType]); // Dependencies for the effect

  return (
    <Card className="w-full max-w-sm shadow-lg">
      <CardHeader className="text-center">
        <CardTitle>Two-Factor Authentication</CardTitle>
        <CardDescription>
          Enter the code from your authenticator app.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleVerify)}>
          <CardContent className="space-y-4">
             {/* Display MFA Setup Error Alert */}
             {mfaSetupError && (
              <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>MFA Setup Error</AlertTitle>
                  <AlertDescription>{mfaSetupError}</AlertDescription>
                </Alert>
              )}
            {/* Display Verification Error Alert */}
             {error && (
              <Alert variant="destructive">
                 <AlertCircle className="h-4 w-4" />
                <AlertTitle>Verification Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <FormField
              control={form.control}
              name="mfaCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Verification Code</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="6-digit code"
                      maxLength={6}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="\d{6}"
                      {...field}
                      disabled={isVerifying || !!mfaSetupError} // Disable if setup error occurred
                      autoFocus
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex flex-col items-center gap-4">
            <Button type="submit" disabled={isVerifying || !form.formState.isValid || !!mfaSetupError} className="w-full">
              {isVerifying ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</>
              ) : (
                 <> <ShieldCheck className="mr-2 h-4 w-4" /> Verify Code</>
              )}
            </Button>
            {onCancel && (
              <Button variant="link" type="button" onClick={onCancel} disabled={isVerifying} size="sm" className="text-muted-foreground">
                Cancel
              </Button>
            )}
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
