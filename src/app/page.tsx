
'use client';

import Link from 'next/link';
import React, { useRef } from 'react';
import { AiMatcher, type AiMatcherRef } from '@/components/ai-matcher';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  BrainCircuit,
  Users,
  LayoutDashboard,
  Activity,
  GitCompareArrows,
  Lock,
  FileText,
  Split,
  CheckCircle,
  Rocket,
  Zap,
  Workflow,
  HardDrive,
  ShieldCheck,
  ChevronRight,
  UserPlus,
  Briefcase,
  Sparkles,
  UsersRound,
  GanttChart,
  Award,
  TrendingUp,
} from 'lucide-react';
import { HeaderNavigationClient } from '@/components/header-navigation-client';

const keyFeaturesData = [
  {
    icon: BrainCircuit,
    title: 'AI-Powered Instant Matching & Auto Assignment',
    description: 'Parses plain-language briefs, finds best-fit freelancers by skills/style/availability, then auto-assigns microtasks for immediate kickoff.',
    isNew: true,
  },
  {
    icon: Split,
    title: 'Microtasks Engine',
    description: 'Decomposes large projects into bite-sized tasks run in parallel and aggregates individual outputs into a cohesive deliverable.',
  },
  {
    icon: ShieldCheck,
    title: 'Built-In Quality Assurance',
    description: 'Automated linting, spec checks and optional peer-review steps ensure every output meets your standards before delivery.',
  },
  {
    icon: UsersRound,
    title: 'Universal Digital Skill Support',
    description: 'One hub for any computer-based work—graphic design, copywriting, editing, video, CAD, development, marketing assets, and more.',
  },
  {
    icon: GitCompareArrows,
    title: 'Seamless Project-Management Integrations',
    description: 'Native connectors for Monday.com and Microsoft Teams let you post tasks, track progress, chat and manage approvals without leaving your existing workspace.',
  },
  {
    icon: Workflow,
    title: 'Dynamic Workflow Engine',
    description: 'Manages dependencies and reroutes work in real time based on performance metrics.',
  },
];

const hireverseWorkflowData = [
  {
    icon: FileText,
    title: "Submit Your Brief",
    description: "Provide your project goals and requirements easily and clearly.",
  },
  {
    icon: BrainCircuit,
    title: "Instant Talent Matching",
    description: "AI immediately matches you with precisely vetted freelancers suited to your project’s unique needs.",
  },
  {
    icon: Split,
    title: "Microtask Efficiency",
    description: "Your project is intelligently divided into parallel microtasks, speeding up delivery through simultaneous expert collaboration.",
  },
  {
    icon: GanttChart,
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

export default function Home() {
  const aiMatcherRef = useRef<AiMatcherRef>(null);

  const handleStartProjectClick = () => {
    aiMatcherRef.current?.triggerSubmit();
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6 sticky top-0 z-50 bg-background/80 backdrop-blur-sm">
        <Link href="/" aria-label="Hireverse AI Home" className="flex items-center gap-2">
           <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">Hireverse AI</span>
        </Link>
        <HeaderNavigationClient />
      </header>

      <main className="flex-1">
        <section className="py-20 md:py-28">
          <div className="container mx-auto px-4 md:px-6 grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6 text-center md:text-left">
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
                Harness AI Precision with Expert Oversight
              </h1>
              <p className="max-w-2xl text-lg text-muted-foreground md:text-xl">
                Combine cutting-edge AI decision-making with human expertise. Hireverse is the platform for streamlined project execution.
              </p>
              <Button
                size="lg"
                onClick={handleStartProjectClick}
                className="bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90 transition-opacity duration-300 shadow-lg"
              >
                Start a Project <Rocket className="ml-2 h-5 w-5" />
              </Button>
            </div>
            <div className="flex justify-center">
               <div className="w-full max-w-xl">
                <AiMatcher ref={aiMatcherRef} />
              </div>
            </div>
          </div>
        </section>

        <Separator className="my-12" />

         <section className="container mx-auto px-4 py-16 md:px-6">
           <h2 className="mb-12 text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Core Features
           </h2>
           <Accordion type="single" collapsible className="w-full max-w-4xl mx-auto" defaultValue="item-0">
              {keyFeaturesData.map((feature, index) => (
                  <AccordionItem value={`item-${index}`} key={feature.title} className="border-b">
                    <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                      <div className="flex items-center gap-4">
                        <feature.icon className="h-6 w-6 text-primary" />
                        {feature.title}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 text-base text-muted-foreground pl-14">
                      {feature.description}
                    </AccordionContent>
                  </AccordionItem>
              ))}
           </Accordion>
        </section>

        <Separator className="my-12" />

        <section id="hireverse-ai-workflow" className="container mx-auto px-4 py-16 md:px-6">
          <h2 className="mb-16 text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Our Workflow, Simplified
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {hireverseWorkflowData.map((step) => (
                <Card key={step.title} className="text-center hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                  <CardHeader className="items-center">
                    <div className="p-4 bg-primary/10 rounded-full mb-4">
                      <step.icon className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle>{step.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{step.description}</p>
                  </CardContent>
                </Card>
              ))}
          </div>
        </section>

        <Separator className="my-12" />

        <section className="py-16 bg-muted/50">
            <div className="container mx-auto px-4 md:px-6 text-center">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-6">
                    Join Our Thriving Freelancer Community
                </h2>
                <p className="max-w-3xl mx-auto text-lg text-muted-foreground md:text-xl mb-10">
                    Connect with peers, earn XP by completing projects, unlock badges to showcase your expertise, and climb the leaderboard. At Hireverse AI, your growth is recognized and rewarded.
                </p>
                 <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <Button size="lg" variant="outline" asChild className="hover:bg-accent/10 transition-colors">
                        <Link href="/community">
                            Explore Community <ChevronRight className="ml-2 h-5 w-5" />
                        </Link>
                    </Button>
                    <Button size="lg" asChild className="bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90 transition-opacity shadow-lg">
                        <Link href="/freelancer/signup">
                            Become a Freelancer <UserPlus className="ml-2 h-5 w-5" />
                        </Link>
                    </Button>
                </div>
            </div>
        </section>

        <Separator className="my-12" />

        <section className="container mx-auto px-4 py-16 text-center md:px-6">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Start your first AI-led project today.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground md:text-xl">
              Eliminate scope creep, late work, and bad hires.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
              <Button
                size="lg"
                onClick={handleStartProjectClick}
                className="bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90 transition-opacity shadow-lg"
              >
                Start a Project <Rocket className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="#hireverse-ai-workflow">
                  See How It Works
                </Link>
              </Button>
            </div>
          </div>
        </section>

      </main>

      <footer className="border-t bg-muted/50 py-8 mt-12">
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
