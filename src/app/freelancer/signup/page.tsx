
import { FreelancerSignupForm } from '@/components/freelancer-signup-form';
import Link from 'next/link';
// Keep Image import in case it's used elsewhere, or remove if truly unused.
// import Image from 'next/image';

export default function FreelancerSignupPage() {
  return (
    <div className="flex min-h-screen flex-col">
       {/* Simple Header */}
       <header className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <Link href="/" aria-label="Hireverse AI Home" className="flex items-center gap-2">
           {/* Removed Image placeholder */}
           {/* <Image src="https://picsum.photos/150/32?random=logo" alt="Hireverse AI Placeholder Logo" width={150} height={32} /> */}
           {/* Added Text Logo */}
           <span className="text-xl font-bold text-foreground">Hireverse AI</span>
        </Link>
        {/* No navigation needed on signup page */}
      </header>

      {/* Main Content - Ensure vertical and horizontal centering */}
      <main className="flex flex-1 items-center justify-center py-12"> {/* Centering container */}
        {/* Added flex justify-center to center the form within the container */}
        <div className="container mx-auto flex justify-center px-4 md:px-6"> {/* Container for content */}
          <FreelancerSignupForm /> {/* Form component itself has max-width */}
        </div>
      </main>

      {/* Simple Footer - Pushed to bottom */}
      <footer className="border-t bg-muted/40 py-6 mt-auto"> {/* mt-auto pushes footer down */}
        <div className="container mx-auto flex flex-col items-center justify-between px-4 text-center text-sm text-muted-foreground md:flex-row md:px-6">
          <p>&copy; {new Date().getFullYear()} Hireverse AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

