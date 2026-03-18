import { ClientLoginForm } from '@/components/client-login-form';
import { AuthLayout } from '@/components/auth/auth-layout';

export default function ClientLoginPage() {
  return (
    <AuthLayout role="client" variant="login">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome back</h1>
        <p className="text-muted-foreground">Sign in to your client account.</p>
      </div>
      <ClientLoginForm />
    </AuthLayout>
  );
}
