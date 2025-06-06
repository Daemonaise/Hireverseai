
import Link from 'next/link';
import Image from 'next/image'; // Keep for other images if any
import { FeatureCard } from '@/components/feature-card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { AiMatcher } from '@/components/ai-matcher'; // Import AiMatcher
import {
  BrainCircuit,    // AI Project Breakdown, AI Match
  Users,           // Smart Freelancer Matching, Instant Team Formation, Parallel Human Processing
  UserPlus,        // For Instant Team Assembly, Freelancer Signup
  LayoutDashboard,   // Real-Time Collaboration Dashboard
  Activity,        // Continuous Performance Monitoring
  GitCompareArrows, // Multi-Model Cross-Validation
  Lock,            // Secure and Transparent Payments
  FileText,        // Submit Your Brief
  Split,           // Microtask Efficiency
  GanttChart,      // Dynamic Project Management (Used for "Project Updates" in workflow)
  CheckCircle,     // Quality-Assured Delivery, Integrated Quality Assurance
  Rocket,          // Seamless Project Completion, Call to Action
  Zap,             // Optimized Task Assignment
  Workflow,        // Effortless Integrations
  HardDrive,       // Secure Asset Management
  ShieldCheck,     // Security Badges
  ChevronRight,    // For CTA button
  // Briefcase,       // No longer directly used, but keep if needed for other features
  // SquareCode,      // Icons for skillset categories removed
  // DraftingCompass,
  // Palette,
  // Video,
  // PenLine,
  // Trophy,
} from 'lucide-react';
import { HeaderNavigationClient } from '@/components/header-navigation-client';


// Data for "Key Features" Section (Updated based on user input)
const keyFeaturesData = [
  {
    icon: BrainCircuit,
    title: "AI Project Breakdown",
    description: "Convert general requests into structured tasks, precise technical specs, and accurate budget estimates using Genkit-driven prompt logic.",
  },
  {
    icon: Users,
    title: "Smart Freelancer Matching",
    description: "Our AI thoroughly evaluates freelancer expertise, portfolios, and past projects to surface only the best-matched talent for your needs.",
  },
  {
    icon: LayoutDashboard,
    title: "Real-Time Collaboration Dashboard",
    description: "Communicate, share files, manage tasks, and track progress in a unified workspace—no external tools required.",
  },
  {
    icon: Activity,
    title: "Continuous Performance Monitoring",
    description: "AI proactively monitors task completion, communication quality, and pace, offering real-time optimization suggestions and risk alerts.",
  },
  {
    icon: GitCompareArrows,
    title: "Multi-Model Cross-Validation",
    description: "Outputs undergo reviews by leading models (Gemini, GPT-4o, Claude), ensuring discrepancies are identified and resolved before final submission.",
  },
  {
    icon: Lock,
    title: "Secure and Transparent Payments",
    description: "Payments are securely processed via Stripe with clear, upfront project pricing and timeline estimates—no hidden fees or hourly uncertainty.",
  },
];

// Data for "Hireverse AI Workflow" Section (Updated based on user input)
const hireverseWorkflowData = [
  {
    icon: FileText,
    title: "Submit Your Brief",
    description: "Provide your project goals and requirements easily and clearly.",
  },
  {
    icon: BrainCircuit, // Re-using BrainCircuit for AI Match
    title: "Instant Talent Matching",
    description: "AI immediately matches you with precisely vetted freelancers suited to your project’s unique needs.",
  },
  {
    icon: Split,
    title: "Microtask Efficiency",
    description: "Your project is intelligently divided into parallel microtasks, speeding up delivery through simultaneous expert collaboration.",
  },
  {
    icon: GanttChart, // Using GanttChart as it was present in previous version for updates
    title: "Dynamic Project Management",
    description: "Track real-time progress, communicate effortlessly, and request updates or changes anytime.",
  },
  {
    icon: CheckCircle,
    title: "Quality-Assured Delivery",
    description: "Every task undergoes automated quality checks and optional peer reviews for unmatched precision.",
  },
  {
    icon: Rocket,
    title: "Seamless Project Completion",
    description: "Receive your fully assembled, ready-to-launch project seamlessly integrated from completed microtasks.",
  },
];

// Data for "Core Platform Features" Section (Updated based on user input)
const corePlatformFeaturesData = [
  {
    icon: Users, // Re-using Users icon
    title: "Parallel Human Processing",
    description: "Boost project speed dramatically by breaking large projects into efficiently managed microtasks executed simultaneously.",
    isNew: true,
  },
  {
    icon: UserPlus,
    title: "Instant Team Formation",
    description: "Automatically assemble ideal freelancer teams tailored specifically to each project’s requirements.",
  },
  {
    icon: Zap,
    title: "Optimized Task Assignment",
    description: "Tasks are swiftly routed to the most qualified and available freelancers using advanced AI matching.",
  },
  {
    icon: CheckCircle, // Re-using CheckCircle icon
    title: "Integrated Quality Assurance",
    description: "Built-in automated checks and optional peer reviews ensure every deliverable meets high-quality standards.",
  },
  {
    icon: Workflow,
    title: "Effortless Integrations",
    description: "Easily connect and manage your projects within tools like Monday.com, Microsoft Teams, and more.",
  },
  {
    icon: HardDrive,
    title: "Secure Asset Management",
    description: "Centralized file sharing, version control, and robust security ensure safe and organized management of all project assets.",
  },
];


export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6 sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <Link href="/" aria-label="Hireverse AI Home" className="flex items-center gap-2">
           <span className="text-xl font-bold text-foreground">Hireverse AI</span>
        </Link>
        <HeaderNavigationClient />
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-white py-20 md:py-28 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-white via-gray-50 to-gray-100/50 opacity-50"></div>
          <div className="container mx-auto px-4 md:px-6 flex flex-col md:flex-row items-center text-center md:text-left relative z-10">
            <div className="md:w-1/2 space-y-6">
              <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
                Harness AI Precision with Expert Oversight
              </h1>
              <p className="max-w-2xl text-lg text-muted-foreground md:text-xl">
                Combine cutting-edge AI decision-making with human expertise. hireverse.ai is the go-to platform for streamlined project execution, connecting clients to perfectly matched freelancers through AI-driven task breakdowns and rigorous talent vetting.
              </p>
              <Button size="lg" asChild className="bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 transition-transform duration-300">
                <Link href="/client/signup">
                  Start a Project <Rocket className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
            <div className="md:w-1/2 mt-10 md:mt-0 flex justify-center md:justify-end">
              {/* Replaced Image with AiMatcher component */}
              <div className="w-full max-w-xl"> {/* Added a wrapper for sizing control */}
                <AiMatcher />
              </div>
            </div>
          </div>
        </section>

        <div className="py-8 md:py-10"> {/* Adjusted spacing */}
          <Separator />
        </div>

        {/* How It Works (Paragraph Section) */}
        <section id="how-it-works" className="container mx-auto px-4 py-12 md:px-6 md:py-16">
           <div className="text-center mb-10">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-gray-900">
              How It Works
            </h2>
           </div>
           <div className="max-w-3xl mx-auto text-lg text-muted-foreground text-center leading-relaxed">
            <p>
              Describe your project in simple, plain English. Our AI instantly translates your request into clear milestones, specifications, and role requirements. It then matches you with top-tier freelancers based on skills, availability, and fit. Collaborate seamlessly in one intuitive dashboard, with AI dynamically refining project scope, team composition, and deliverables as needed.
            </p>
           </div>
        </section>

        <div className="py-8 md:py-10"> <Separator /> </div>

         {/* Key Features Section */}
         <section className="container mx-auto px-4 py-12 md:px-6 md:py-16 bg-muted/30 rounded-lg">
           <h2 className="mb-12 text-center text-3xl font-bold tracking-tight sm:text-4xl text-gray-900">
            Key Features
           </h2>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
              {keyFeaturesData.map((feature) => (
                  <div key={feature.title} className="flex items-start gap-4 p-1 hover:scale-[1.02] transition-transform duration-300">
                      <div className="flex-shrink-0 mt-1 bg-primary/10 p-2 rounded-md">
                        <feature.icon className="h-8 w-8 text-primary stroke-2" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-1">{feature.title}</h3>
                        <p className="text-muted-foreground">{feature.description}</p>
                      </div>
                  </div>
              ))}
           </div>
        </section>

        <div className="py-8 md:py-10"> <Separator /> </div>

        {/* Hireverse AI Workflow Section */}
        <section id="hireverse-ai-workflow" className="container mx-auto px-4 py-12 md:px-6 md:py-16">
          <h2 className="mb-16 text-center text-3xl font-bold tracking-tight sm:text-4xl text-gray-900">
            Hireverse AI Workflow
          </h2>
          <div className="relative max-w-4xl mx-auto">
            {/* Vertical line for timeline effect */}
            <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-primary/20 transform -translate-x-1/2 hidden md:block rounded-full"></div>
            <div className="space-y-12 md:space-y-16">
              {hireverseWorkflowData.map((step, index) => (
                <div key={step.title} className={`flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-10 ${index % 2 !== 0 ? 'md:flex-row-reverse' : ''}`}>
                  {/* Icon and Number Bubble - Centered for mobile, side for desktop */}
                  <div className="flex-shrink-0 flex md:flex-col items-center relative z-10">
                    <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xl font-bold border-2 border-primary/30 shadow-md mb-2 md:mb-0 md:mr-0">
                      {index + 1}
                    </div>
                    <div className="md:mt-3 p-3 bg-white rounded-full shadow-lg border border-muted">
                      <step.icon className="h-8 w-8 text-primary stroke-2" />
                    </div>
                  </div>
                   {/* Text Content Card */}
                  <div className={`p-6 rounded-lg shadow-xl w-full md:w-2/3 bg-white hover:shadow-2xl transition-shadow duration-300 border border-muted/50 ${index % 2 !== 0 ? 'md:text-right' : 'md:text-left'}`}>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{step.title}</h3>
                    <p className="text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="py-8 md:py-10"> <Separator /> </div>

        {/* Core Platform Features Section */}
        <section className="container mx-auto px-4 py-12 md:px-6 md:py-16 bg-muted/30 rounded-lg">
          <h2 className="mb-12 text-center text-3xl font-bold tracking-tight sm:text-4xl text-gray-900">
            Core Platform Features
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {corePlatformFeaturesData.map((feature) => (
              <div key={feature.title} className="p-1"> {/* Added p-1 for hover effect breathing room */}
                <FeatureCard
                  icon={<feature.icon className="h-8 w-8 text-primary stroke-2" />}
                  title={feature.title}
                  description={feature.description}
                  isNew={feature.isNew}
                  className="bg-white border-2 border-primary hover:scale-[1.03] hover:shadow-xl transition-transform duration-300"
                />
              </div>
            ))}
          </div>
        </section>

        <div className="py-8 md:py-10"> <Separator /> </div>

        {/* Integration & Security Section */}
        <section className="py-16 bg-muted/30">
            <div className="container mx-auto px-4 md:px-6">
                <h2 className="text-2xl font-semibold text-center text-gray-900 mb-10">Trusted Integrations &amp; Security</h2>
                <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-8">
                    <Image src="https://placehold.co/150x60.png" alt="Monday.com Logo" width={150} height={60} className="opacity-70 hover:opacity-100 transition-opacity" data-ai-hint="Monday.com logo" />
                    <Image src="https://placehold.co/150x60.png" alt="Microsoft Teams Logo" width={150} height={60} className="opacity-70 hover:opacity-100 transition-opacity" data-ai-hint="Microsoft Teams logo" />
                    <Image src="https://placehold.co/120x60.png" alt="Stripe Logo" width={120} height={60} className="opacity-70 hover:opacity-100 transition-opacity" data-ai-hint="Stripe logo" />
                    <div className="flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
                        <ShieldCheck className="h-10 w-10 text-accent" /> {/* Changed to accent green */}
                        <span className="font-medium text-muted-foreground">SSL Secured</span>
                    </div>
                </div>
            </div>
        </section>

        <div className="py-8 md:py-10"> <Separator /> </div>

        {/* Call to Action Section */}
        <section className="container mx-auto px-4 py-16 text-center md:px-6">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Start your first AI-led project today.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground md:text-xl">
              Eliminate scope creep, late work, and bad hires.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" asChild className="bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 transition-transform duration-300">
                <Link href="/client/signup">
                  Start a Project <Rocket className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="text-primary border-primary hover:bg-primary/10 hover:text-primary hover:scale-105 transition-transform duration-300">
                <Link href="#how-it-works">
                  See How It Works <ChevronRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/30 py-8 mt-12">
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
