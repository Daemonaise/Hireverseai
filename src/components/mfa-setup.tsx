
'use client';

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Loader2, QrCode, AlertCircle } from 'lucide-react'; // Added AlertCircle
import { useToast } from '@/hooks/use-toast';
import { generateMfaUri, enableUserMfa, verifyMfaToken } from '@/services/firestore'; // Assuming verifyMfaToken exists
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
// import QRCode from 'qrcode.react'; // Consider adding this library for actual QR code generation

interface MfaSetupProps {
  userId: string;
  userEmail: string; // For QR code label
  userType: 'client' | 'freelancer';
  mfaSecret: string;
  onVerified: () => void; // Callback when MFA is successfully verified and enabled
  onCancel?: () => void; // Optional callback if user cancels
}

const formSchema = z.object({
  mfaCode: z.string().length(6, { message: 'Code must be 6 digits.' }).regex(/^\d{6}$/, { message: 'Code must contain only digits.' }),
});

type FormSchema = z.infer<typeof formSchema>;

export function MfaSetup({ userId, userEmail, userType, mfaSecret, onVerified, onCancel }: MfaSetupProps) {
  const [isVerifying, startVerificationTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [qrCodeUri, setQrCodeUri] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      mfaCode: '',
    },
    mode: 'onChange',
  });

  useEffect(() => {
    // Define an async function inside useEffect to handle the promise
    async function fetchUri() {
      if (mfaSecret && userEmail) {
        try {
          const uri = await generateMfaUri(userEmail, 'Hireverse AI', mfaSecret); // Await the promise
          setQrCodeUri(uri); // Now uri is a string
        } catch (err) {
          setError("Could not generate the setup QR code.");
        }
      }
    }
    fetchUri(); // Call the async function
  }, [mfaSecret, userEmail]); // Dependencies remain the same


  const handleVerify = useCallback(async (values: FormSchema): Promise<void> => {
    setError(null);
    startVerificationTransition(async () => {
      try {
        // 1. Verify the token client-side first (optional but good UX)
        const isValidClientSide = verifyMfaToken(mfaSecret, values.mfaCode);

        if (!isValidClientSide) {
          throw new Error("Invalid verification code. Please check your authenticator app.");
        }

        // 2. Call backend/service to confirm verification and enable MFA
        // In a real app, this might be an API call. Here, we call the Firestore service directly.
        await enableUserMfa(userId, userType);

        toast({
          title: 'MFA Enabled!',
          description: 'Multi-Factor Authentication is now active for your account.',
          variant: 'default',
        });
        onVerified(); // Trigger completion callback

      } catch (err: any) {
        const message = err.message || "Failed to verify code. Please try again.";
        setError(message);
        // toast({ title: "Verification Failed", description: message, variant: "destructive" }); // Toast can be redundant
      }
    });
  }, [userId, userType, mfaSecret, onVerified, toast]);

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader>
        <CardTitle>Set Up Multi-Factor Authentication</CardTitle>
        <CardDescription>
          Scan the QR code with your authenticator app (e.g., Google Authenticator, Authy) or enter the key manually.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* QR Code Display */}
        <div className="flex justify-center p-4 bg-white rounded-md border">
          {qrCodeUri ? (
             // TODO: Replace placeholder with actual QR Code component
             // <QRCode value={qrCodeUri} size={160} level="M" />
             <QrCode className="h-40 w-40 text-black" /> // Placeholder
          ) : (
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Manual Key Display */}
        <div>
          <p className="text-sm text-muted-foreground">Manual setup key:</p>
          <div className="mt-1 px-3 py-2 rounded-md bg-muted text-sm font-mono break-all border select-all">
            {mfaSecret || 'Generating...'}
          </div>
        </div>

        {/* Verification Code Input Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleVerify)} className="space-y-4">
            <FormField
              control={form.control}
              name="mfaCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Enter Verification Code</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="6-digit code"
                      maxLength={6}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="\d{6}"
                      {...field}
                      disabled={isVerifying}
                      autoFocus // Focus on the input field
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Display MFA Verification Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Verification Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={isVerifying || !form.formState.isValid} className="w-full">
              {isVerifying ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</>
              ) : (
                'Verify & Enable MFA'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      {onCancel && (
        <CardFooter className="justify-center border-t pt-4">
          <Button variant="link" onClick={onCancel} disabled={isVerifying}>
            Cancel Setup
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
