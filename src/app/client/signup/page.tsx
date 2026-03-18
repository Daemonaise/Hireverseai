import { ClientSignupForm } from '@/components/client-signup-form';
import { AuthLayout } from '@/components/auth/auth-layout';

export default function ClientSignupPage() {
  return (
    <AuthLayout role="client" variant="signup">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Create your account</h1>
        <p className="text-muted-foreground">Start getting expert work done today.</p>
      </div>
      <ClientSignupForm />
    </AuthLayout>
  );
}
