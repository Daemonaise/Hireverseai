'use client';

import React, { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface MfaVerifyProps {
  userId: string;
  userType: 'client' | 'freelancer';
  onVerified: () => void;
  onCancel?: () => void;
}

const formSchema = z.object({
  mfaCode: z.string().length(6, { message: 'Code must be 6 digits.' }).regex(/^\d{6}$/, { message: 'Code must contain only digits.' }),
});

type FormSchema = z.infer<typeof formSchema>;

export function MfaVerify({ userId, userType, onVerified, onCancel }: MfaVerifyProps) {
  const [isVerifying, startVerificationTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: { mfaCode: '' },
    mode: 'onChange',
  });

  const handleVerify = async (values: FormSchema): Promise<void> => {
    setError(null);
    startVerificationTransition(async () => {
      try {
        const token = await user?.getIdToken();
        if (!token) {
          setError('Not authenticated. Please log in again.');
          return;
        }

        const res = await fetch('/api/auth/verify-mfa', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ code: values.mfaCode, userType }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Verification failed.');
          form.resetField('mfaCode');
          return;
        }

        if (!data.valid) {
          setError('Invalid verification code. Please try again.');
          form.resetField('mfaCode');
          return;
        }

        toast({
          title: 'Verification Successful',
          description: 'You are now logged in.',
        });
        onVerified();
      } catch {
        setError('An unexpected error occurred. Please try again.');
        form.resetField('mfaCode');
      }
    });
  };

  return (
    <Card className="w-full max-w-sm shadow-lg">
      <CardHeader className="text-center">
        <CardTitle>Two-Factor Authentication</CardTitle>
        <CardDescription>Enter the code from your authenticator app.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleVerify)}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
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
                      disabled={isVerifying}
                      autoFocus
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex flex-col items-center gap-4">
            <Button type="submit" disabled={isVerifying || !form.formState.isValid} className="w-full">
              {isVerifying ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</>
              ) : (
                <><ShieldCheck className="mr-2 h-4 w-4" /> Verify Code</>
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
