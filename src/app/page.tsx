

import Link from 'next/link';
import { FeatureCard } from '@/components/feature-card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge'; // Import Badge for "NEW" label
import {
  CheckCircle, Code, Edit3, Palette, Split, Video, Workflow, Layers, Users, Trophy, UserPlus, Zap, ListChecks, Wand2, Timer, ShieldCheck, BarChart, Rocket, ChevronRight, FileText, BrainCircuit, GanttChart, DraftingCompass, GitBranchPlus, // Added necessary icons
  Cpu, Wrench, SquareCode, Lock, Server, HardDrive, // Added HardDrive for Secure Asset Management
  Briefcase, Clock, Database, // Added Clock, Database
} from 'lucide-react'; // Added Lock, Server
import { WorkflowGrid } from '@/components/workflow-grid'; // Import the new WorkflowGrid component
import { HeaderNavigationClient } from '@/components/header-navigation-client'; // Import the new client component
import { AiMatcher } from '@/components/ai-matcher';

// Data for Core Platform Features (Updated to 6 items) - Reordered
const coreFeatures = [
   {
    icon: <Split className="h-8 w-8 text-primary" />,
    title: "Human Parallel Processing",
    description: "Splits larger projects into microtasks so freelancers work in parallel, dramatically speeding up delivery.",
    isNew: true,
  },
  {
    icon: <Users className="h-8 w-8 text-primary" />,
    title: "Instant Team Assembly",
    description: "AI automatically builds the optimal freelance team based on project needs.",
  },
   {
    icon: <Zap className="h-8 w-8 text-primary" />,
    title: "Automated Task Routing",
    description: "AI instantly matches tasks to the best-fit, available freelancers.",
  },
  {
    icon: <CheckCircle className="h-8 w-8 text-primary" />,
    title: "Built-In Quality Assurance",
    description: "Automated checks and optional peer reviews ensure outputs meet your standards.",
  },
  {
    icon: <Workflow className="h-8 w-8 text-primary" />,
    title: "Seamless Integrations",
    description: "Connect with Monday.com, Microsoft Teams, and more to manage projects within your workflow.",
    integrationLogos: false, // Logos removed
  },
   {
    icon: <HardDrive className="h-8 w-8 text-primary" />, // Updated Icon
    title: "Secure Asset Management",
    description: "Centralized, protected file sharing and version control for all project assets.",
  },
];

// Data for Freelancer Skillsets (Reordered and Updated Descriptions/Icons)
const freelancerSkillsets = [
  {
    icon: <SquareCode className="h-8 w-8 text-primary" />,
    title: "Development & Tech",
    description: "AI model building, neural networks, distributed systems, data science, API development, web apps, and more.",
  },
  {
    icon: <DraftingCompass className="h-8 w-8 text-primary" />,
    title: "Engineering & Drafting",
    description: "CAD drafting, product prototyping, mechanical design, controls engineering, and schematics.",
  },
  {
    icon: <Palette className="h-8 w-8 text-primary" />,
    title: "Graphic Design",
    description: "Logos, branding, marketing materials, UX/UI design, illustrations, and presentations.",
  },
  {
    icon: <Video className="h-8 w-8 text-primary" />, // Updated icon/category
    title: "Media Production",
    description: "Video editing, music production, podcast editing, motion graphics, and animation.",
  },
  {
    icon: <Edit3 className="h-8 w-8 text-primary" />,
    title: "Copywriting & Editing",
    description: "Technical writing, marketing content, blog posts, website copy, and proofreading.",
  },
  {
    icon: <Briefcase className="h-8 w-8 text-primary" />,
    title: "Additional Expertise",
    description: "Recruiting, business strategy, virtual assistance, translation, and many other specialized services.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header - Make sticky */}
      <header className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6 sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <Link href="/" aria-label="Hireverse AI Home" className="flex items-center gap-2">
           <span className="text-xl font-bold text-foreground">Hireverse AI</span>
        </Link>
        {/* Navigation - Client Component */}
         <HeaderNavigationClient />
      </header>

      <main className="flex-1">
        {/* Hero Section - Updated */}
        <section className="container mx-auto flex flex-col items-center px-4 py-20 text-center md:px-6 md:py-28"> {/* Adjusted padding */}
          <div className="flex flex-col items-center space-y-6 w-full max-w-3xl">
            {/* Updated Headline */}
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
              AI Hiring Solutions Built for Speed and Precision
            </h1>
            {/* Updated Sub-headline */}
            <p className="max-w-[700px] text-lg text-muted-foreground md:text-xl">
               Harness the speed of AI and the power of human parallel processing. Submit your project brief and get matched with top freelancers who solve problems faster, smarter, and together.
            </p>
            {/* AI Matcher Component */}
            <div className="mt-8 w-full max-w-xl">
                <AiMatcher />
            </div>
            {/* Updated CTA button (Optional, could be removed if AiMatcher handles it) */}
            {/* <div className="mt-8">
                <Button size="lg" asChild>
                   <Link href="/client/signup">Start Hiring Smarter</Link>
                </Button>
            </div> */}
          </div>
        </section>

        {/* Separator */}
        <Separator className="my-16 md:my-20" />

        {/* How It Works Section - Using WorkflowGrid */}
        <section className="container mx-auto px-4 pb-16 pt-8 md:px-6 lg:pb-24">
           <h2 className="mb-12 text-center text-3xl font-bold tracking-tight sm:text-4xl">
             How Hireverse AI Works
           </h2>
           {/* WorkflowGrid itself handles responsiveness */}
           <WorkflowGrid />
        </section>

        {/* Separator */}
        <Separator className="my-16 md:my-20" />

         {/* Core Platform Features Section - Updated with Responsive Grid Layout */}
         <section className="container mx-auto px-4 pb-16 pt-8 md:px-6 lg:pb-24">
           <h2 className="mb-12 text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Core Platform Features
           </h2>
           {/* Using Responsive Grid Layout for Feature Tiles */}
           <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {coreFeatures.map((feature) => (
                  <div key={feature.title} className="p-1"> {/* Added padding wrapper for visual spacing */}
                      <FeatureCard
                        icon={feature.icon}
                        title={feature.title}
                        description={feature.description}
                        integrationLogos={feature.integrationLogos}
                        isNew={feature.isNew} // Pass isNew prop
                      />
                  </div>
              ))}
           </div>
        </section>

        {/* Separator */}
        <Separator className="my-16 md:my-20" />

        {/* Freelancer Skillsets Section - Updated with Responsive Grid Layout */}
        <section className="container mx-auto px-4 pb-16 pt-8 md:px-6 lg:pb-24">
            <h2 className="mb-12 text-center text-3xl font-bold tracking-tight sm:text-4xl">
                Freelancer Skillsets
            </h2>
            {/* Using Responsive Grid Layout for Skill Tiles */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {freelancerSkillsets.map((skillset) => (
                   <div key={skillset.title} className="p-1"> {/* Added padding wrapper */}
                     {/* Can replace FeatureCard with a simpler tile if needed */}
                      <FeatureCard
                          icon={skillset.icon}
                          title={skillset.title}
                          description={skillset.description}
                       />
                   </div>
                ))}
            </div>
        </section>

         {/* Separator */}
         <Separator className="my-16 md:my-20" />

         {/* Gamified Community Section */}
        <section className="container mx-auto px-4 pb-16 pt-8 md:px-6 lg:pb-24">
           <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Join Our Thriving Community
              </h2>
              <p className="mt-3 max-w-2xl mx-auto text-muted-foreground md:text-lg">
                Engage, learn, and grow with fellow freelancers. Earn rewards and climb the leaderboard!
              </p>
           </div>
           <div className="grid gap-8 md:grid-cols-2">
                <FeatureCard
                    icon={<Trophy className="h-8 w-8 text-primary" />}
                    title="Gamified Leaderboard"
                    description="Showcase your skills and contributions. Earn XP and badges to climb the ranks."
                />
                <FeatureCard
                    icon={<Users className="h-8 w-8 text-primary" />}
                    title="Peer Mentoring & Forums"
                    description="Connect with peers, share knowledge, and get support in our community forums."
                />
           </div>
            <div className="text-center mt-8">
                <Button asChild>
                    <Link href="/community">View Leaderboard & Join</Link>
                </Button>
            </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/40 py-6 mt-12">
        <div className="container mx-auto flex flex-col items-center justify-between px-4 text-center text-sm text-muted-foreground md:flex-row md:px-6">
          <p>&copy; {new Date().getFullYear()} Hireverse AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
