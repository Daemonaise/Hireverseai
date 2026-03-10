import type { Metadata } from 'next';
import { LoginForm } from '@/components/login-form';
import Link from 'next/link';
import { SiteLogo } from '@/components/site-logo';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function FreelancerLoginPage() {
  return (
    <div className="dark flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <Link href="/" aria-label="Hireverse AI Home">
            <SiteLogo className="h-9 w-auto" variant="dark" />
          </Link>
          <nav className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Need an account?</span>
            <Link href="/freelancer/signup" className="text-sm font-medium text-primary hover:underline">
              Sign Up
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center py-16 px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="text-primary font-bold text-base select-none">⟩</span>
              <span className="text-xs font-semibold uppercase tracking-widest text-primary">Freelancers</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome back</h1>
            <p className="text-muted-foreground">Sign in to your freelancer account.</p>
          </div>
          <LoginForm userType="freelancer" />
        </div>
      </main>

      <footer className="border-t border-border py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Hireverse AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
