import { FreelancerProfile } from '@/components/freelancer-profile';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface FreelancerProfilePageProps {
  params: {
    id: string; // The freelancer ID from the URL
  };
}

export default function FreelancerProfilePage({ params }: FreelancerProfilePageProps) {
  const freelancerId = params.id;

  return (
      <div className="flex min-h-screen flex-col">
          {/* Simple Header */}
          <header className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
              <Link href="/" aria-label="Hireverse AI Home" className="flex items-center gap-2">
                  <span className="text-xl font-bold text-foreground">Hireverse AI</span>
              </Link>
               <nav className="flex items-center gap-4">
                 <Button variant="ghost" asChild>
                     <Link href="/community">Community</Link>
                 </Button>
                 <Button variant="outline" asChild>
                     <Link href="/freelancer/signup">Freelancer Signup</Link>
                 </Button>
               </nav>
          </header>

          <main className="flex flex-1 items-start justify-center py-12">
              <div className="container mx-auto px-4 md:px-6 max-w-3xl">
                   {/* Render the profile component, passing the ID */}
                   <FreelancerProfile freelancerId={freelancerId} />

                   {/* Optional: Add navigation back or other actions */}
                   <div className="mt-8 text-center">
                       <Button variant="link" asChild>
                           <Link href="/community">Back to Leaderboard</Link>
                       </Button>
                   </div>
              </div>
          </main>

          {/* Simple Footer */}
          <footer className="border-t bg-muted/40 py-6">
              <div className="container mx-auto flex flex-col items-center justify-between px-4 text-center text-sm text-muted-foreground md:flex-row md:px-6">
                  <p>&copy; {new Date().getFullYear()} Hireverse AI. All rights reserved.</p>
              </div>
          </footer>
      </div>
  );
}
