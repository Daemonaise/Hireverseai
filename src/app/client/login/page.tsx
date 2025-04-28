
import { ClientLoginForm } from '@/components/client-login-form'; // Create this component
import Link from 'next/link';

export default function ClientLoginPage() {
  return (
    <div className="flex min-h-screen flex-col">
       <header className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <Link href="/" aria-label="Hireverse AI Home" className="flex items-center gap-2">
           <span className="text-xl font-bold text-foreground">Hireverse AI</span>
        </Link>
         <nav className="flex items-center gap-4">
             <span className="text-sm text-muted-foreground">Need an account?</span>
             <Link href="/client/signup" className="text-sm font-medium text-primary hover:underline">
                 Sign Up
             </Link>
         </nav>
      </header>

      <main className="flex flex-1 items-center justify-center py-12">
        <div className="container mx-auto px-4 md:px-6 max-w-md">
          <ClientLoginForm />
        </div>
      </main>

      <footer className="border-t bg-muted/40 py-6 mt-auto">
        <div className="container mx-auto flex flex-col items-center justify-between px-4 text-center text-sm text-muted-foreground md:flex-row md:px-6">
          <p>&copy; {new Date().getFullYear()} Hireverse AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
