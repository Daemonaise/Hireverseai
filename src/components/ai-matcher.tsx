// ai-matcher.tsx (FULL FIXED VERSION)
'use client';

import React, { useState, useTransition, useRef, useEffect, useCallback, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Info, Clock, DollarSign, Layers, Check, X, ChevronDown, ChevronUp, AlertCircle, Loader2, Wand2, Bot, Calendar, Tag, Hourglass } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { matchFreelancer } from '@/ai/flows/match-freelancer';
import { generateProjectIdea } from '@/ai/flows/generate-project-idea';
import type { GenerateProjectIdeaOutput } from '@/ai/schemas/generate-project-idea-schema';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  projectBrief: z.string().min(20).max(2000),
  freelancerId: z.string().optional(),
});

type FormSchema = z.infer<typeof formSchema>;

const checkAuthentication = (): { isAuthenticated: boolean; userId: string | null } => {
  return { isAuthenticated: true, userId: 'test-client-001' };
};

export function AiMatcher() {
  const [isPending, startTransition] = useTransition();
  const [matchResult, setMatchResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFreelancerIdInput, setShowFreelancerIdInput] = useState(false);
  const freelancerIdInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const router = useRouter();
  const [isMatching, setIsMatching] = useState(false);
  const [isIdeaChatOpen, setIsIdeaChatOpen] = useState(false);
  const [generatedIdea, setGeneratedIdea] = useState<GenerateProjectIdeaOutput | null>(null);
  const [ideaLoading, setIdeaLoading] = useState(false);
  const [ideaGenerationCounter, setIdeaGenerationCounter] = useState(0);
  const [ideaError, setIdeaError] = useState<string | null>(null);

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: { projectBrief: '', freelancerId: '' },
    mode: 'onChange',
  });

  useEffect(() => {
    if (showFreelancerIdInput && freelancerIdInputRef.current) {
      freelancerIdInputRef.current.focus();
    }
  }, [showFreelancerIdInput]);

  const handleGenerateIdea = useCallback(async () => {
    setIdeaGenerationCounter(prev => prev + 1);
    if (ideaGenerationCounter >= 3) {
      alert("You exceeded idea request limit.");
      setIdeaGenerationCounter(0);
      return;
    }
    setIsIdeaChatOpen(true);
    setIdeaLoading(true);
    setIdeaError(null);
    setGeneratedIdea(null);

    try {
      // Inside handleGenerateIdea:
      const result = await generateProjectIdea();
      if (result.status === 'error') {
        setIdeaError(result.reasoning || "Failed to generate idea.");
      } else {
        setGeneratedIdea(result);
      }
    } catch (err: any) {
      setIdeaError(err.message || "Unexpected error.");
    } finally {
      setIdeaLoading(false);
    }
  }, [ideaGenerationCounter]);

  const onSubmit = useCallback((values: FormSchema) => {
    setError(null);
    setMatchResult(null);
    setIsMatching(true);
    const { isAuthenticated, userId } = checkAuthentication();

    if (!isAuthenticated) {
      toast({ title: "Authentication Required", description: "Please login.", variant: "destructive" });
      setIsMatching(false);
      return;
    }

    startTransition(async () => {
      try {
        const flowInput = { projectBrief: values.projectBrief, freelancerId: userId ?? undefined };
        const result = await matchFreelancer(flowInput);
        setMatchResult(result);

        if (result.status === 'matched') {
          router.push(`/checkout?projectId=${result.matchedFreelancerId ?? 'error'}&cost=${result.totalCostToClient ?? 0}`);
          return;
        }

        toast({
          title: result.status === 'error' ? "Error" : "Processing Complete",
          description: result.reasoning,
          variant: result.status === 'error' ? 'destructive' : 'default',
        });
      } catch (err: any) {
        setError(err.message || "Failed to process project brief.");
      } finally {
        setIsMatching(false);
      }
    });
  }, [toast, router]);

  const renderResultDetails = useMemo(() => {
    if (!matchResult || matchResult.status === 'error') return null;
    const iconStyle = "h-4 w-4 text-muted-foreground shrink-0";

    return (
      <div className="mt-3 space-y-3 text-sm">
        {matchResult.estimatedTimeline && (
          <div className="flex items-center gap-2">
            <Clock className={iconStyle} />
            <span>Est. Timeline: <span className="font-medium">{matchResult.estimatedTimeline}</span></span>
          </div>
        )}
        {matchResult.estimatedHours != null && matchResult.estimatedHours > 0 && (
          <div className="flex items-center gap-2">
            <Hourglass className={iconStyle} />
            <span>Est. Hours: <span className="font-medium">{matchResult.estimatedHours}</span></span>
          </div>
        )}
        {matchResult.extractedSkills?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {matchResult.extractedSkills.map((skill: string) => (
              <Badge key={skill} variant="secondary">{skill}</Badge>
            ))}
          </div>
        )}
      </div>
    );
  }, [matchResult]);

  return (
    <Card className="w-full shadow-md">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <CardContent className="pt-6 space-y-4">
            <FormField control={form.control} name="projectBrief" render={({ field }) => (
              <FormItem>
                <FormLabel>Project Brief</FormLabel>
                <FormControl>
                  <Textarea {...field} placeholder="Describe your project..." />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <Button type="submit" disabled={!form.formState.isValid || isPending || isMatching}>
              {isPending || isMatching ? (<Loader2 className="h-4 w-4 animate-spin" />) : ("Match Freelancers")}
            </Button>

            {matchResult && !error && (
              <Alert variant="default">
                <AlertTitle>Result</AlertTitle>
                <AlertDescription>{matchResult.reasoning}</AlertDescription>
                {renderResultDetails}
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </form>
      </Form>

      <Dialog open={isIdeaChatOpen} onOpenChange={setIsIdeaChatOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle><Bot className="h-5 w-5" /> AI Project Idea Generator</DialogTitle>
            <DialogDescription>AI suggestions for your next project idea.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {ideaLoading && (<Loader2 className="h-8 w-8 animate-spin text-primary" />)}
            {ideaError && (<Alert variant="destructive"><AlertDescription>{ideaError}</AlertDescription></Alert>)}
            {generatedIdea && (
              <div>
                <h4>{generatedIdea.idea}</h4>
                {generatedIdea.details && <p>{generatedIdea.details}</p>}
              </div>
            )}
          </div>
          <DialogFooter>
            {generatedIdea && (
              <Button onClick={() => { form.setValue('projectBrief', generatedIdea.idea); setIsIdeaChatOpen(false); }}>Use This Idea</Button>
            )}
            <Button variant="secondary" onClick={() => setIsIdeaChatOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

