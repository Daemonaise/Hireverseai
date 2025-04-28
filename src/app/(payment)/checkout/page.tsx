'use client';

import React, { useState, useEffect, Suspense } from 'react';
import {  StripeElementsOptions, loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Loader2} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
  throw new Error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set.');
}

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

interface CheckoutFormProps {
  clientSecret: string;
  projectId: string;
}

function CheckoutForm({ clientSecret, projectId }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      console.warn("Stripe.js hasn't loaded yet.");
      return;
    }

    setIsLoading(true);
    setMessage(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/client/dashboard?payment_intent_status=succeeded&project_id=${projectId}`,
      },
    });

    if (error.type === "card_error" || error.type === "validation_error") {
      setMessage(error.message || 'An unexpected error occurred.');
      toast({ title: "Payment Error", description: error.message, variant: "destructive" });
    } else {
      setMessage("An unexpected error occurred during payment confirmation.");
      toast({ title: "Payment Error", description: "An unexpected error occurred.", variant: "destructive" });
    }

    setIsLoading(false);
  };

  return (
    <form id="payment-form" onSubmit={handleSubmit}>
      <PaymentElement id="payment-element" options={{ layout: 'tabs' }} />
      <Button disabled={isLoading || !stripe || !elements} id="submit" className="w-full mt-4">
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Pay Now"}
      </Button>
      {message && <div className="text-destructive text-sm mt-2 text-center">{message}</div>}
    </form>
  );
}

function CheckoutPageInner() {
  const [clientSecret, setClientSecret] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams?.get('projectId');
  const baseCost = Number(searchParams?.get('cost'));

  useEffect(() => {
    if (!projectId || isNaN(baseCost) || baseCost <= 0) {
      setError("Missing or invalid project details for payment.");
      setIsLoading(false);
      return;
    }

    fetch('/api/stripe/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, baseCost, clientId: 'test-client-001' }),
    })
      .then((res) => {
         if (!res.ok) throw new Error(`Failed to fetch payment intent (${res.status})`);
         return res.json();
      })
      .then((data) => {
         if (data.clientSecret) {
           setClientSecret(data.clientSecret);
         } else {
           throw new Error(data.error || 'Missing client secret from server.');
         }
      })
      .catch((err) => {
          console.error("Error fetching client secret:", err);
          setError(`Failed to initialize payment: ${err.message}`);
      })
      .finally(() => setIsLoading(false));
  }, [projectId, baseCost, router]);

  const appearance: StripeElementsOptions['appearance'] = {
    theme: 'stripe',
    variables: {
        colorPrimary: '#00A8FF',
        colorBackground: '#ffffff',
        colorText: '#0D1B2A',
        colorDanger: '#df1b41',
        fontFamily: 'Ideal Sans, system-ui, sans-serif',
        spacingUnit: '4px',
        borderRadius: '6px',
    },
  };
  
  const options: StripeElementsOptions = {
    clientSecret,
    appearance,
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 py-12">
      <Card className="w-full max-w-md shadow-lg">
          <CardHeader>
              <CardTitle>Complete Project Payment</CardTitle>
              <CardDescription>Enter payment details to start project: {projectId}</CardDescription>
          </CardHeader>
          <CardContent>
              {isLoading && <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>}
              {error && <p className="text-center text-destructive">{error}</p>}
              {clientSecret && !isLoading && !error && (
                  <Elements options={options} stripe={stripePromise}>
                      <CheckoutForm clientSecret={clientSecret} projectId={projectId!} />
                  </Elements>
              )}
          </CardContent>
          {!isLoading && error && (
              <CardFooter>
                  <Button variant="outline" onClick={() => router.back()} className="w-full">Go Back</Button>
              </CardFooter>
          )}
      </Card>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CheckoutPageInner />
    </Suspense>
  );
}
