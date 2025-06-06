
import Link from 'next/link';
import { FeatureCard } from '@/components/feature-card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { WorkflowGrid } from '@/components/workflow-grid'; // For "How hireverse AI Works"
import {
  BrainCircuit,    // For AI Decomposition Engine
  UserCheck,       // For Freelancer Matching
  LayoutDashboard,   // For Realtime Dashboard
  ShieldCheck,     // For Continuous Vetting & Security, Built-In Quality Assurance
  GitCompareArrows, // For Cross-Validation
  Lock,            // For Security and Simplicity
  Users,           // For Instant Team Assembly
  UserPlus,        // For Signup buttons
  Rocket,          // For CTA button, Delivery
  ChevronRight,    // For CTA button
  Split,           // For Human Parallel Processing, Microtasks
  Zap,             // For Automated Task Routing
  Workflow,        // For Seamless Integrations (lucide-react icon name)
  HardDrive,       // For Secure Asset Management
  FileText,        // For Submit Brief
  CheckCircle,     // For QA
  GanttChart,      // For Project Updates
} from 'lucide-react';
import { HeaderNavigationClient } from '@/components/header-navigation-client';

// Data for "Key Features" Section
const keyFeaturesData = [
  {
    icon: <BrainCircuit className="h-8 w-8 text-primary" />,
    title: "AI Decomposition Engine",
    description: "Transform vague requests into concrete deliverables using Genkit-powered prompt logic. Projects are broken into tasks, technical specs, and estimated cost windows.",
  },
  {
    icon: <UserCheck className="h-8 w-8 text-primary" />,
    title: "Freelancer Matching",
    description: "AI evaluates freelancer resumes, portfolios, and past work against decomposed project data. Only optimal candidates are surfaced to clients.",
  },
  {
    icon: <LayoutDashboard className="h-8 w-8 text-primary" />,
    title: "Realtime Dashboard",
    description: "Clients and freelancers operate within a unified workspace. All communication, files, tasks, and notes live in one system—no external project tools needed.",
  },
  {
    icon: <ShieldCheck className="h-8 w-8 text-primary" />,
    title: "Continuous Vetting",
    description: "The AI continuously monitors task completion, communication quality, and delivery pace to suggest team optimizations and flag risks.",
  },
  {
    icon: <GitCompareArrows className="h-8 w-8 text-primary" />,
    title: "Cross-Validation",
    description: "Multiple models (Gemini, GPT-4o, Claude) review outputs before submission. Discrepancies are flagged with suggested edits.",
  },
  {
    icon: <Lock className="h-8 w-8 text-primary" />,
    title: "Security and Simplicity",
    description: "All payments are handled via Stripe. No hourly ambiguity—project fees and timelines are estimated up front using model-calculated baselines.",
  },
];

// Data for "Core Platform Features" Section
const corePlatformFeaturesData = [
  {
    icon: <Split className="h-8 w-8 text-primary" />,
    title: "Human Parallel Processing",
    description: "Splits larger projects into microtasks so freelancers work in parallel, dramatically speeding up delivery.",
    isNew: true, // Mark as new
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
    icon: <ShieldCheck className="h-8 w-8 text-primary" />,
    title: "Built-In Quality Assurance",
    description: "Automated checks and optional peer reviews ensure outputs meet your standards.",
  },
  {
    icon: <Workflow className="h-8 w-8 text-primary" />, // Using Workflow icon for integrations
    title: "Seamless Integrations",
    description: "Connect with Monday.com, Microsoft Teams, and more to manage projects within your workflow.",
  },
  {
    icon: <HardDrive className="h-8 w-8 text-primary" />,
    title: "Secure Asset Management",
    description: "Centralized, protected file sharing and version control for all project assets.",
  },
];

// WorkflowGrid data is defined within its own component (src/components/workflow-grid.tsx)
// The items match the "How hireverse AI Works" steps.

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6 sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <Link href="/" aria-label="Hireverse AI Home" className="flex items-center gap-2">
           <span className="text-xl font-bold text-foreground">Hireverse AI</span>
        </Link>
        <HeaderNavigationClient />
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="container mx-auto flex flex-col items-center px-4 py-20 text-center md:px-6 md:py-28">
          <div className="flex flex-col items-center space-y-6 w-full max-w-3xl">
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
              Harness AI Precision with Expert Fine-Tuning
            </h1>
            <p className="max-w-[700px] text-lg text-muted-foreground md:text-xl">
              Combine cutting-edge AI decision-making with the nuanced oversight of a human expert. hireverse.ai is the operating system for project execution, pairing clients with precision-matched freelancers through AI-led project decomposition and vetting workflows.
            </p>
          </div>
        </section>

        <Separator className="my-12 md:my-16" />

        {/* How It Works (Text Section) */}
        <section id="how-it-works-text" className="container mx-auto px-4 pb-12 pt-8 md:px-6 lg:pb-16">
           <div className="text-center mb-10">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              How It Works
            </h2>
           </div>
           <div className="max-w-3xl mx-auto text-lg text-muted-foreground text-center leading-relaxed">
            <p>
              Create a project request in plain English. AI breaks it into milestones, specs, and role types. Top-matching freelancers are recommended based on skill, availability, and model-determined fit. Project collaboration occurs in a single dashboard, with the AI continuously adjusting scope, team suggestions, and deliverables.
            </p>
           </div>
        </section>

        <Separator className="my-12 md:my-16" />

         {/* Key Features Section */}
         <section className="container mx-auto px-4 pb-12 pt-8 md:px-6 lg:pb-16">
           <h2 className="mb-10 text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Key Features
           </h2>
           <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {keyFeaturesData.map((feature) => (
                  <div key={feature.title} className="p-1">
                      <FeatureCard
                        icon={feature.icon}
                        title={feature.title}
                        description={feature.description}
                      />
                  </div>
              ))}
           </div>
        </section>

        <Separator className="my-12 md:my-16" />

        {/* How hireverse AI Works (WorkflowGrid Section) */}
        <section id="how-hireverse-ai-works-grid" className="container mx-auto px-4 pb-12 pt-8 md:px-6 lg:pb-16">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              How Hireverse AI Works
            </h2>
          </div>
          <div className="max-w-4xl mx-auto">
            <WorkflowGrid />
          </div>
        </section>

        <Separator className="my-12 md:my-16" />

        {/* Core Platform Features Section */}
        <section className="container mx-auto px-4 pb-12 pt-8 md:px-6 lg:pb-16">
          <h2 className="mb-10 text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Core Platform Features
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {corePlatformFeaturesData.map((feature) => (
              <div key={feature.title} className="p-1">
                <FeatureCard
                  icon={feature.icon}
                  title={feature.title}
                  description={feature.description}
                  isNew={feature.isNew}
                />
              </div>
            ))}
          </div>
        </section>

        <Separator className="my-12 md:my-16" />

        {/* Call to Action Section */}
        <section className="container mx-auto px-4 py-12 text-center md:px-6 md:py-16">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Start your first AI-led project today.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground md:text-xl">
              Eliminate scope creep, late work, and bad hires.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" asChild>
                <Link href="/client/signup">
                  Start a Project <Rocket className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="#how-hireverse-ai-works-grid"> {/* Updated link to the grid section */}
                  See How It Works <ChevronRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/40 py-6 mt-12">
        <div className="container mx-auto flex flex-col items-center justify-between px-4 text-center text-sm text-muted-foreground md:flex-row md:px-6">
          <p>&copy; {new Date().getFullYear()} Hireverse AI. All rights reserved.</p>
          <div className="mt-4 md:mt-0">
            <Link href="https://resume.hireverse.ai/" target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline">
              Looking for help with your resume?
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
