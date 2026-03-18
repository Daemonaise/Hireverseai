'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/motion';
import { SiteLogo } from '@/components/site-logo';
import { AuthBrandPanel } from './auth-brand-panel';

interface AuthLayoutProps {
  role: 'freelancer' | 'client';
  variant: 'login' | 'signup';
  children: React.ReactNode;
}

const TOGGLE_LINKS = {
  freelancer: {
    login: { text: 'Need an account?', label: 'Sign Up', href: '/freelancer/signup' },
    signup: { text: 'Already have an account?', label: 'Log In', href: '/freelancer/login' },
  },
  client: {
    login: { text: 'Need an account?', label: 'Sign Up', href: '/client/signup' },
    signup: { text: 'Already have an account?', label: 'Log In', href: '/client/login' },
  },
};

export function AuthLayout({ role, variant, children }: AuthLayoutProps) {
  const toggle = TOGGLE_LINKS[role][variant];

  return (
    <div className="flex min-h-screen">
      {/* Left brand panel (hidden on mobile) */}
      <AuthBrandPanel role={role} />

      {/* Right form panel */}
      <div className="flex-1 flex flex-col bg-background">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 h-16 shrink-0">
          {/* Logo (mobile only — desktop has it in brand panel) */}
          <Link href="/" className="md:invisible">
            <SiteLogo className="h-8 w-auto" />
          </Link>

          <nav className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{toggle.text}</span>
            <Link href={toggle.href} className="font-medium text-primary hover:underline">
              {toggle.label}
            </Link>
          </nav>
        </header>

        {/* Form area */}
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <motion.div
            initial={fadeInUp.initial}
            animate={fadeInUp.animate}
            className="w-full max-w-md"
          >
            {children}
          </motion.div>
        </main>

        {/* Footer */}
        <footer className="px-6 py-4 text-center text-xs text-muted-foreground shrink-0">
          &copy; {new Date().getFullYear()} Hireverse AI. All rights reserved.
        </footer>
      </div>
    </div>
  );
}
