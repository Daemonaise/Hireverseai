import { FreelancerSignupForm } from '@/components/freelancer-signup-form';
import { AuthLayout } from '@/components/auth/auth-layout';

export default function FreelancerSignupPage() {
  return (
    <AuthLayout role="freelancer" variant="signup">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="text-primary font-bold text-base select-none">⟩</span>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">Freelancers</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Join Hireverse</h1>
        <p className="text-muted-foreground">Create your freelancer account and start earning.</p>
      </div>
      <FreelancerSignupForm />
    </AuthLayout>
  );
}
