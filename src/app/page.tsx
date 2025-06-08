
'use client'; // This page uses client-side hooks (useRef, useState)

import Link from 'next/link';
import Image from 'next/image';
import React, { useRef } from 'react'; // Added useRef
import { AiMatcher, type AiMatcherRef } from '@/components/ai-matcher'; // Import AiMatcher and its Ref type
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge'; // Import Badge
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
  GanttChart, // For workflow
  Award, // For badges/leaderboard
  TrendingUp, // For XP/growth
} from 'lucide-react';
import { HeaderNavigationClient } from '@/components/header-navigation-client';

// Data for "Key Features" Section
const keyFeaturesData = [
  {
    icon: BrainCircuit,
    title: 'AI-Powered Instant Matching',
    description: 'Parses your plain-language project brief and finds the best-fit freelancers by skills, style, and availability in seconds. Accesses and assesses freelancer community, looking for currently available, logged in talent. There\'s no talent "marketplace", the system acts like Uber to load balance and match first/best available.',
    isNew: true, // Mark as new if applicable
  },
  {
    icon: Split, // Changed from Layers to Split
    title: 'Human Parallel Processing (Microtasks Engine)',
    description: 'Automatically splits larger projects into bite-sized tasks that many freelancers tackle simultaneously, then aggregates their outputs into a complete deliverable.',
  },
  {
    icon: ShieldCheck, // Changed from Check to ShieldCheck for QA
    title: 'Built-In Quality Assurance',
    description: 'Automated reviews (grammar, code linting, design spec checks) plus optional peer-review steps ensure every output meets your standards before delivery.',
  },
  {
    icon: UsersRound, // Changed from Users to UsersRound
    title: 'Universal Digital Skill Support',
    description: 'One hub for any computer-based work—graphic design, copywriting, editing, video production, CAD, development, marketing assets, and more.',
  },
  {
    icon: GitCompareArrows, // Changed from LayoutDashboard to GitCompareArrows
    title: 'Seamless Project-Management Integrations',
    description: 'Native connectors for Monday.com and Microsoft Teams let you post tasks, track progress, chat, and manage approvals without leaving your existing workspace.',
  },
];


// Data for "Hireverse AI Workflow" Section (Vertical Timeline)
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
              <Button
                size="lg"
                onClick={handleStartProjectClick}
                className="bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 transition-transform duration-300"
              >
                Start a Project <Rocket className="ml-2 h-5 w-5" />
              </Button>
            </div>
            <div className="md:w-1/2 mt-10 md:mt-0 flex justify-center md:justify-end">
               <div className="w-full max-w-xl">
                <AiMatcher ref={aiMatcherRef} />
              </div>
            </div>
          </div>
        </section>

        <div className="py-8 md:py-10"> <Separator /> </div>

        {/* Key Features Section */}
         <section className="container mx-auto px-4 py-12 md:px-6 md:py-16 bg-gray-50 rounded-lg">
           <h2 className="mb-12 text-center text-3xl font-bold tracking-tight sm:text-4xl text-gray-900">
            Key Features
           </h2>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
              {keyFeaturesData.map((feature) => (
                  <div key={feature.title} className="flex items-start gap-4 p-1 hover:scale-[1.02] transition-transform duration-300">
                      <div className="flex-shrink-0 mt-1">
                        <feature.icon className="h-8 w-8 text-primary stroke-2" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-1 flex items-center gap-2">
                            {feature.title}
                            {feature.isNew && (
                                <Badge variant="default" className="text-xs whitespace-nowrap bg-green-500 text-white border-green-600">
                                    NEW
                                </Badge>
                            )}
                        </h3>
                        <p className="text-muted-foreground">{feature.description}</p>
                      </div>
                  </div>
              ))}
           </div>
        </section>

        <div className="py-8 md:py-10"> <Separator /> </div>

        {/* Hireverse AI Workflow Section (Vertical Timeline) */}
        <section id="hireverse-ai-workflow" className="container mx-auto px-4 py-12 md:px-6 md:py-16">
          <h2 className="mb-10 text-center text-3xl font-bold tracking-tight sm:text-4xl text-gray-900">
            Hireverse AI Workflow
          </h2>
          <div className="max-w-3xl mx-auto text-lg text-muted-foreground text-center leading-relaxed mb-16">
            <p>
              Describe your project in simple, plain English. Our AI instantly translates your request into clear milestones, specifications, and role requirements. It then matches you with top-tier freelancers based on skills, availability, and fit. Collaborate seamlessly in one intuitive dashboard, with AI dynamically refining project scope, team composition, and deliverables as needed.
            </p>
          </div>
          <div className="relative max-w-4xl mx-auto">
            <div className="space-y-12 md:space-y-16">
              {hireverseWorkflowData.map((step, index) => (
                <div key={step.title} className={`flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-10 ${index % 2 !== 0 ? 'md:flex-row-reverse' : ''}`}>
                  <div className="flex-shrink-0 flex md:flex-col items-center relative z-10">
                    <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xl font-bold border-2 border-primary/30 shadow-md mb-2 md:mb-0 md:mr-0">
                      {index + 1}
                    </div>
                    <div className="md:mt-3 p-3 bg-white rounded-full shadow-lg border border-gray-200">
                      <step.icon className="h-8 w-8 text-primary stroke-2" />
                    </div>
                  </div>
                  <div className={`p-6 rounded-lg shadow-xl w-full md:w-2/3 bg-white hover:shadow-2xl transition-shadow duration-300 border border-gray-100 ${index % 2 !== 0 ? 'md:text-right' : 'md:text-left'}`}>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{step.title}</h3>
                    <p className="text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="py-8 md:py-10"> <Separator /> </div>

        {/* Community & Gamification Section */}
        <section className="py-16 bg-gray-50">
            <div className="container mx-auto px-4 md:px-6 text-center">
                <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl mb-6">
                    Join Our Thriving Freelancer Community
                </h2>
                <p className="max-w-2xl mx-auto text-lg text-muted-foreground md:text-xl mb-10">
                    Connect with peers, earn XP by completing projects and participating in challenges,
                    unlock badges to showcase your expertise, and climb the leaderboard.
                    At Hireverse AI, your growth is recognized and rewarded.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                    <div className="flex flex-col items-center p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
                        <UsersRound className="h-12 w-12 text-primary mb-4" />
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">Connect & Collaborate</h3>
                        <p className="text-muted-foreground text-sm">Share knowledge, find support, and build your network.</p>
                    </div>
                    <div className="flex flex-col items-center p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
                        <TrendingUp className="h-12 w-12 text-green-500 mb-4" />
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">Earn XP & Level Up</h3>
                        <p className="text-muted-foreground text-sm">Gain experience points for every task and achievement.</p>
                    </div>
                    <div className="flex flex-col items-center p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
                        <Award className="h-12 w-12 text-yellow-500 mb-4" />
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">Unlock Badges</h3>
                        <p className="text-muted-foreground text-sm">Showcase your skills and milestones with unique badges.</p>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <Button size="lg" variant="outline" asChild className="text-primary border-primary hover:bg-primary/10 hover:text-primary hover:scale-105 transition-transform duration-300">
                        <Link href="/community">
                            Explore Community <ChevronRight className="ml-2 h-5 w-5" />
                        </Link>
                    </Button>
                    <Button size="lg" asChild className="bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 transition-transform duration-300">
                        <Link href="/freelancer/signup">
                            Become a Freelancer <UserPlus className="ml-2 h-5 w-5" />
                        </Link>
                    </Button>
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
              <Button
                size="lg"
                onClick={handleStartProjectClick}
                className="bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 transition-transform duration-300"
              >
                Start a Project <Rocket className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" asChild className="text-primary border-primary hover:bg-primary/10 hover:text-primary hover:scale-105 transition-transform duration-300">
                <Link href="#hireverse-ai-workflow">
                  See How It Works <ChevronRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t bg-gray-50 py-8 mt-12">
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
