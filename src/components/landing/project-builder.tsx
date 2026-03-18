// src/components/landing/project-builder.tsx
'use client';

import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Palette, Code2, PenTool, Video, Megaphone, BarChart3, MoreHorizontal,
  ArrowLeft, ArrowRight, Wand2, Loader2, Rocket, Clock, DollarSign,
  Hourglass, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { generateProjectIdea } from '@/ai/flows/generate-project-idea';
import { matchFreelancer } from '@/ai/flows/match-freelancer';
import type { GenerateProjectIdeaOutput } from '@/ai/schemas/generate-project-idea-schema';

const CATEGORIES = [
  { id: 'design', label: 'Design', icon: Palette, hint: 'graphic design' },
  { id: 'development', label: 'Development', icon: Code2, hint: 'software development' },
  { id: 'writing', label: 'Writing', icon: PenTool, hint: 'content writing' },
  { id: 'video', label: 'Video', icon: Video, hint: 'video production' },
  { id: 'marketing', label: 'Marketing', icon: Megaphone, hint: 'digital marketing' },
  { id: 'data', label: 'Data', icon: BarChart3, hint: 'data analysis' },
  { id: 'other', label: 'Other', icon: MoreHorizontal, hint: undefined },
] as const;

type Category = (typeof CATEGORIES)[number];

const PLACEHOLDERS: Record<string, string> = {
  design: 'Describe the design work you need: logos, UI mockups, illustrations...',
  development: 'Describe the software you want built: web app, API, mobile...',
  writing: 'Describe the content you need: blog posts, copy, documentation...',
  video: 'Describe the video project: explainer, promo, editing...',
  marketing: 'Describe the marketing work: campaigns, SEO, social media...',
  data: 'Describe the data work: analysis, dashboards, scraping...',
  other: 'Describe your project in detail...',
};

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 200 : -200,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -200 : 200,
    opacity: 0,
  }),
};

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-6">
      {[1, 2, 3].map((step, i) => (
        <div key={step} className="flex items-center">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
              current > step
                ? 'bg-primary text-white'
                : current === step
                  ? 'bg-primary text-white'
                  : 'border-2 border-border text-muted-foreground'
            }`}
          >
            {current > step ? <Check className="h-4 w-4" /> : step}
          </div>
          {i < 2 && (
            <div className="w-12 md:w-16 h-0.5 mx-1">
              <div
                className={`h-full transition-colors ${
                  current > step ? 'bg-primary' : 'bg-border'
                }`}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function ProjectBuilder() {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [category, setCategory] = useState<Category | null>(null);
  const [brief, setBrief] = useState('');
  const [preview, setPreview] = useState<GenerateProjectIdeaOutput | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [exampleIdea, setExampleIdea] = useState<GenerateProjectIdeaOutput | null>(null);
  const [exampleLoading, setExampleLoading] = useState(false);
  const [exampleCount, setExampleCount] = useState(0);

  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const goTo = (s: number) => {
    setDirection(s > step ? 1 : -1);
    setStep(s);
  };

  const handleCategory = (cat: Category) => {
    setCategory(cat);
    goTo(2);
  };

  const handleGenerateExample = useCallback(async () => {
    if (exampleCount >= 3) {
      toast({ title: 'Limit reached', description: 'Max 3 examples per session.', variant: 'destructive' });
      return;
    }
    setExampleLoading(true);
    setExampleIdea(null);
    try {
      const result = await generateProjectIdea(
        category?.hint ? { industryHint: category.hint } : undefined
      );
      if (result.status === 'success') {
        setExampleIdea(result);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to generate example.', variant: 'destructive' });
    } finally {
      setExampleLoading(false);
      setExampleCount((c) => c + 1);
    }
  }, [category, exampleCount, toast]);

  const handleAnalyze = useCallback(async () => {
    if (brief.length < 20) {
      toast({ title: 'Too short', description: 'Please describe your project in at least 20 characters.', variant: 'destructive' });
      return;
    }
    setIsAnalyzing(true);
    setPreview(null);
    goTo(3);
    try {
      const result = await generateProjectIdea(
        category?.hint ? { industryHint: category.hint } : undefined
      );
      // The generateProjectIdea flow gives cost estimates - use it for preview
      setPreview(result.status === 'success' ? result : null);
      if (result.status === 'error') {
        toast({ title: 'Analysis failed', description: result.reasoning || 'Try again.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to analyze project.', variant: 'destructive' });
    } finally {
      setIsAnalyzing(false);
    }
  }, [brief, category, toast]);

  const handleStartProject = useCallback(async () => {
    if (!user) {
      // Store brief in sessionStorage for post-auth resume
      sessionStorage.setItem('hireverse_pending_brief', brief);
      router.push('/client/signup?redirect=/');
      return;
    }

    setIsMatching(true);
    try {
      const result = await matchFreelancer({ projectBrief: brief, freelancerId: user.uid });
      if (result.status === 'matched' && result.totalCostToClient && result.totalCostToClient > 0) {
        const projectId = result.projectId || 'unknown';
        router.push(`/checkout?projectId=${projectId}&cost=${result.totalCostToClient}`);
      } else {
        toast({ title: 'Processing', description: result.reasoning || 'We\'ll find a match soon.', variant: 'default' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to start project.', variant: 'destructive' });
    } finally {
      setIsMatching(false);
    }
  }, [brief, user, router, toast]);

  return (
    <div className="rounded-2xl border border-border bg-background/80 backdrop-blur p-6 md:p-8 shadow-2xl">
      <Stepper current={step} />

      <AnimatePresence mode="wait" custom={direction}>
        {step === 1 && (
          <motion.div
            key="step1"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <h3 className="text-lg font-semibold mb-1">What do you need?</h3>
            <p className="text-sm text-muted-foreground mb-4">Pick a category to get started.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategory(cat)}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card p-3 text-sm font-medium transition-all hover:border-primary hover:bg-primary/5 hover:-translate-y-0.5"
                >
                  <cat.icon className="h-4 w-4 text-primary" />
                  {cat.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => goTo(2)}
              className="mt-3 text-xs text-muted-foreground hover:text-primary hover:underline"
            >
              or skip to describe your project
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <h3 className="text-lg font-semibold mb-1">
              Describe your project
              {category && <span className="text-primary ml-1 text-sm font-normal">({category.label})</span>}
            </h3>
            <p className="text-sm text-muted-foreground mb-3">Be specific. The more detail, the better our AI can match.</p>
            <Textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder={PLACEHOLDERS[category?.id ?? 'other']}
              className="min-h-[120px] max-h-[200px] resize-y mb-3"
            />

            {/* Inline example */}
            {exampleIdea && (
              <div className="rounded-lg border border-border bg-muted/50 p-3 mb-3 text-sm">
                <p className="font-semibold">{exampleIdea.idea}</p>
                {exampleIdea.details && <p className="text-muted-foreground mt-1">{exampleIdea.details}</p>}
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2"
                  onClick={() => {
                    setBrief(`${exampleIdea.idea}: ${exampleIdea.details ?? ''}`);
                    setExampleIdea(null);
                  }}
                >
                  Use This
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => goTo(1)}>
                  <ArrowLeft className="mr-1 h-4 w-4" /> Back
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleGenerateExample}
                  disabled={exampleLoading || exampleCount >= 3}
                  className="text-primary"
                >
                  {exampleLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Wand2 className="mr-1 h-4 w-4" />}
                  Example{exampleCount > 0 ? ` (${exampleCount}/3)` : ''}
                </Button>
              </div>
              <Button size="sm" onClick={handleAnalyze} disabled={brief.length < 20 || isAnalyzing}>
                Next <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="step3"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
          >
            {isAnalyzing ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                <p className="text-sm text-muted-foreground">Analyzing your project...</p>
              </div>
            ) : preview ? (
              <div>
                <h3 className="text-lg font-semibold mb-3">Project Preview</h3>
                <div className="space-y-3 text-sm">
                  {preview.estimatedTimeline && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>Timeline: <span className="font-medium">{preview.estimatedTimeline}</span></span>
                    </div>
                  )}
                  {preview.estimatedHours != null && (
                    <div className="flex items-center gap-2">
                      <Hourglass className="h-4 w-4 text-muted-foreground" />
                      <span>Est. Hours: <span className="font-medium">{preview.estimatedHours}</span></span>
                    </div>
                  )}
                  {preview.totalCostToClient != null && preview.totalCostToClient > 0 && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span>Est. Cost: <span className="font-medium">${preview.totalCostToClient.toFixed(2)}</span></span>
                    </div>
                  )}
                  {preview.requiredSkills && preview.requiredSkills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {preview.requiredSkills.map((skill) => (
                        <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between mt-6">
                  <Button size="sm" variant="ghost" onClick={() => goTo(2)}>
                    <ArrowLeft className="mr-1 h-4 w-4" /> Refine
                  </Button>
                  <Button size="sm" onClick={handleStartProject} disabled={isMatching}>
                    {isMatching ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Rocket className="mr-1 h-4 w-4" />}
                    Start This Project
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Could not generate preview. <button onClick={() => goTo(2)} className="text-primary hover:underline">Try again</button></p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
