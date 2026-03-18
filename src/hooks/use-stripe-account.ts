import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth-context';

interface StripeAccountStatus {
  hasAccount: boolean;
  onboardingComplete: boolean;
  payoutsEnabled: boolean;
  chargesEnabled?: boolean;
  detailsSubmitted?: boolean;
}

export function useStripeAccount(freelancerId: string) {
  const { user } = useAuth();

  return useQuery<StripeAccountStatus>({
    queryKey: ['stripe-account', freelancerId],
    queryFn: async () => {
      const token = await user?.getIdToken();
      const res = await fetch(
        `/api/stripe/connect/account-status?freelancerId=${freelancerId}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('Failed to fetch account status');
      return res.json();
    },
    enabled: !!freelancerId && !!user,
  });
}
