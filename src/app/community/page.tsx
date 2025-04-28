import { Leaderboard } from '@/components/leaderboard';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { MessageSquare, UserPlus } from 'lucide-react';

export default function CommunityPage() {
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

      <main className="flex-1 py-12">
        <div className="container mx-auto px-4 md:px-6 space-y-12">
          {/* Leaderboard Section */}
          <section>
            <Leaderboard />
          </section>

          <Separator />

          {/* Call to Action / Community Info Section */}
          <section className="text-center">
             <h2 className="text-2xl font-semibold mb-4">Engage & Grow</h2>
             <p className="text-muted-foreground max-w-xl mx-auto mb-6">
               Join discussions, help fellow freelancers, and complete projects to earn XP and badges.
               Your contributions make our community stronger!
             </p>
             <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                <Button size="lg" disabled> {/* Disabled as Forum is not implemented */}
                  <MessageSquare className="mr-2 h-5 w-5" />
                  Visit Forums (Coming Soon)
                </Button>
                 <Button size="lg" variant="outline" asChild>
                    <Link href="/freelancer/signup">
                      <UserPlus className="mr-2 h-5 w-5" />
                       Join as a Freelancer
                    </Link>
                </Button>
             </div>
          </section>

           {/* Optional: Section for featured badges or recent activity */}
           {/* <Separator />
           <section>
               <h3 className="text-xl font-semibold mb-4 text-center">Featured Badges</h3>
               {/* Display some example badges here */}
           {/* </section> */}

        </div>
      </main>

      {/* Simple Footer */}
      <footer className="border-t bg-muted/40 py-6 mt-12">
        <div className="container mx-auto flex flex-col items-center justify-between px-4 text-center text-sm text-muted-foreground md:flex-row md:px-6">
          <p>&copy; {new Date().getFullYear()} Hireverse AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

