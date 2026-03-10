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
import { signInAuthUser, isUserMfaEnabled, updateFreelancerStatus } from '@/services/firestore';

interface LoginFormProps {
  userType: 'client' | 'freelancer';
}

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters.' }),
});

type FormSchema = z.infer<typeof formSchema>;

export function LoginForm({ userType }: LoginFormProps) {
  const [isPending, startTransition] = useTransition();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');
  const [userIdForMfa, setUserIdForMfa] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const isFreelancer = userType === 'freelancer';
  const title = isFreelancer ? 'Freelancer Login' : 'Client Login';
  const description = isFreelancer ? 'Access your dashboard' : 'Access your project dashboard';
  const emailLabel = isFreelancer ? 'Email Address' : 'Business Email';
  const emailPlaceholder = isFreelancer ? 'you@example.com' : 'you@company.com';
  const dashboardPath = isFreelancer ? '/freelancer/dashboard' : '/client/dashboard';

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', password: '' },
  });

  const completeLogin = useCallback(async (userId: string) => {
    if (isFreelancer) {
      try {
        await updateFreelancerStatus(userId, 'available', true);
      } catch {
        toast({
          title: 'Login Warning',
          description: 'Logged in, but failed to update your status. Please update manually in dashboard.',
          variant: 'destructive',
          duration: 7000,
        });
      }
    }
    toast({ title: 'Login Successful', description: 'Redirecting to your dashboard...' });
    router.push(dashboardPath);
  }, [isFreelancer, dashboardPath, toast, router]);

  const handlePasswordSubmit = useCallback(async (values: FormSchema) => {
    setLoginError(null);
    setUserIdForMfa(null);
    startTransition(async () => {
      try {
        const loginResult = await signInAuthUser(values.email, values.password);
        if (!loginResult?.userId) throw new Error('Invalid email or password.');
        const userId = loginResult.userId;

        const mfaEnabled = await isUserMfaEnabled(userId, userType);
        if (mfaEnabled) {
          setUserIdForMfa(userId);
          setStep('mfa');
          toast({ title: 'Enter Verification Code', description: 'Please enter the code from your authenticator app.' });
        } else {
          await completeLogin(userId);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Login failed. Please check your credentials.';
        setLoginError(errorMessage);
        setStep('credentials');
      }
    });
  }, [userType, toast, completeLogin]);

  const handleMfaVerified = useCallback(() => {
    if (userIdForMfa) {
      completeLogin(userIdForMfa);
    } else {
      setLoginError('An unexpected error occurred after MFA verification.');
      setStep('credentials');
    }
  }, [userIdForMfa, completeLogin]);

  const handleMfaCancel = () => {
    setStep('credentials');
    setUserIdForMfa(null);
    setLoginError(null);
    form.reset();
  };

  if (step === 'mfa' && userIdForMfa) {
    return (
      <MfaVerify
        userId={userIdForMfa}
        userType={userType}
        onVerified={handleMfaVerified}
        onCancel={handleMfaCancel}
        onInvalidCredentials={() => {
          setLoginError('MFA setup incomplete or secret missing. Cannot log in. Please contact support.');
          setStep('credentials');
        }}
      />
    );
  }

  return (
    <Card className="w-full card-glow-auth">
      <CardHeader className="text-center">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handlePasswordSubmit)}>
          <CardContent className="space-y-4">
            {loginError && step === 'credentials' && (
              <Alert variant="destructive" className="w-full">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Login Error</AlertTitle>
                <AlertDescription>{loginError}</AlertDescription>
              </Alert>
            )}
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>{emailLabel}</FormLabel>
                <FormControl><Input type="email" placeholder={emailPlaceholder} {...field} disabled={isPending} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl><Input type="password" placeholder="••••••••" {...field} disabled={isPending} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
          <CardFooter className="flex flex-col items-center gap-4">
            <Button type="submit" disabled={isPending || !form.formState.isValid} className="w-full">
              {isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Logging In...</>
              ) : (
                <><LogIn className="mr-2 h-4 w-4" />Login</>
              )}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
