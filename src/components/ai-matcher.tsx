
'use client';

import React, { useState, useTransition, useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Info, Clock, DollarSign, Layers, Check, X, ChevronDown, ChevronUp, AlertCircle, Loader2, Wand2, Bot, Calendar, Tag, Hourglass, Rocket } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  projectBrief: z.string().min(20, { message: "Please describe your project in detail (minimum 20 characters)." }).max(2000, { message: "Project brief cannot exceed 2000 characters." }),
  freelancerId: z.string().optional(),
});

type FormSchema = z.infer<typeof formSchema>;

// Placeholder: Replace with actual authentication check from context or session
const checkAuthentication = (): { isAuthenticated: boolean; userId: string | null } => {
   return { isAuthenticated: true, userId: 'test-client-001' };
};

export interface AiMatcherRef {
  triggerSubmit: () => void;
}

// Props for AiMatcher (if any, currently none beyond ref)
interface AiMatcherProps {}

export const AiMatcher = forwardRef<AiMatcherRef, AiMatcherProps>((props, ref) => {
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
       toast({
         title: "Example Limit Reached",
         description: "You have reached the maximum number of example generations for this session.",
         variant: "destructive",
       });
       setIdeaGenerationCounter(0);
       return;
    }
    setIsIdeaChatOpen(true);
    setIdeaLoading(true);
    setIdeaError(null);
    setGeneratedIdea(null);

    try {
       const result = await generateProjectIdea();
       if (result.status === 'error') {
         const errorMessage = result.reasoning || `Failed to generate example: Invalid response from AI.`;
         setIdeaError(errorMessage);
         console.warn("[AI Matcher] Idea generation failed:", result);
       } else {
         setGeneratedIdea(result);
       }
    } catch (err: any) {
       console.error('Error in handleGenerateIdea:', err);
       const errorDetails = err.errors ? JSON.stringify(err.errors) : '';
       const errorMessage = `${err.message || "An unexpected error occurred while generating the example."} ${errorDetails}`;
       setIdeaError(errorMessage);
    } finally {
       setIdeaLoading(false);
    }
  }, [ideaGenerationCounter, toast]);


  const onSubmit = useCallback(async (values: FormSchema) => {
    setError(null);
    setMatchResult(null);
    setIsMatching(true);
    const { isAuthenticated, userId } = checkAuthentication();

    if (!isAuthenticated) {
      toast({ title: "Authentication Required", description: "Please login or sign up to match freelancers.", variant: "destructive" });
      setIsMatching(false);
      return;
    }

     toast({
       title: "Matching Freelancers...",
       description: "Please wait while we find the best talent for your project.",
       duration: 3000,
     });

    startTransition(async () => {
      try {
        const flowInput = { projectBrief: values.projectBrief, freelancerId: userId ?? undefined };
        const result = await matchFreelancer(flowInput);
        setMatchResult(result);

        if (result.status === 'error') {
            setError(result.reasoning);
            toast({
                title: "Matching Error",
                description: result.reasoning,
                variant: "destructive",
            });
        } else if (result.status === 'no_available_freelancer') {
             toast({
                title: "No Match Found (Yet!)",
                description: result.reasoning + " We'll keep searching and notify you.",
                variant: "default",
                duration: 5000,
            });
        } else if (result.status === 'matched' && result.totalCostToClient !== undefined && result.totalCostToClient > 0) {
             const checkoutProjectId = result.projectId || 'unknown_project';
            router.push(`/checkout?projectId=${checkoutProjectId}&cost=${result.totalCostToClient}`);
            toast({ title: "Match Found!", description: "Redirecting to payment...", variant: "default" });
            return;
        } else {
             console.warn("Matching status:", result.status, "Cost:", result.totalCostToClient);
             setError(result.reasoning || "Could not finalize match details.");
              toast({
                title: "Processing Complete",
                description: result.reasoning || "Estimate generated, but payment details are missing.",
                variant: "default",
             });
        }
      } catch (err: any) {
        console.error('Error during matchFreelancer flow:', err);
        const errorMessage = err.message || "Failed to process project brief due to an unexpected error.";
        setError(errorMessage);
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
      } finally {
        setIsMatching(false);
      }
    });
  }, [toast, router]);

  useImperativeHandle(ref, () => ({
    triggerSubmit: () => {
      form.handleSubmit(onSubmit)();
    }
  }));

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
        {matchResult.totalCostToClient != null && matchResult.totalCostToClient > 0 && (
             <div className="flex flex-col gap-1 border-t pt-2 mt-2">
                  <div className="flex items-center justify-between">
                       <span>Base Cost:</span> <span className="font-medium">${matchResult.estimatedBaseCost?.toFixed(2)}</span>
                  </div>
                   <div className="flex items-center justify-between">
                       <span>Platform Fee (15%):</span> <span className="font-medium">${matchResult.platformFee?.toFixed(2)}</span>
                   </div>
                    <div className="flex items-center justify-between font-semibold">
                       <span>Total Cost:</span> <span>${matchResult.totalCostToClient.toFixed(2)}</span>
                   </div>
             </div>
        )}
        {matchResult.extractedSkills?.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-2 border-t mt-2">
            <span className="text-muted-foreground mr-1">Skills:</span>
            {matchResult.extractedSkills.map((skill: string) => (
              <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
            ))}
          </div>
        )}
      </div>
    );
  }, [matchResult]);

  return (
    <div className="rounded-lg bg-gradient-to-br from-blue-500 via-purple-600 to-orange-500 p-1 shadow-xl">
      <Card className="w-full border-transparent">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <CardContent className="pt-6 space-y-4">
              <FormField
                control={form.control}
                name="projectBrief"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="projectBrief">
                      Describe your project goal, key deliverables, and any specific requirements...
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        id="projectBrief"
                        {...field}
                        placeholder="e.g., I need a modern logo for my tech startup, focusing on simplicity and scalability. The logo should be versatile for web and print..."
                        className="min-h-[120px] max-h-[250px] resize-y border-2 border-input focus:border-primary"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex flex-col sm:flex-row justify-center items-center gap-2 pt-2">
                <Button
                   size="sm"
                   type="button"
                   onClick={handleGenerateIdea}
                   disabled={ideaLoading || ideaGenerationCounter >= 3}
                   className="w-full sm:w-auto text-primary-foreground bg-gradient-to-r from-orange-500 via-pink-500 to-blue-500 hover:from-orange-600 hover:via-pink-600 hover:to-blue-600 transition-all duration-300 ease-in-out shadow-md hover:shadow-lg px-4 py-2 rounded-md"
                 >
                  <Wand2 className="mr-2 h-4 w-4" /> Need an example?
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending || isMatching || !form.formState.isValid}
                  className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isPending || isMatching ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Rocket className="mr-2 h-5 w-5" />
                  )}
                  {isPending || isMatching ? 'Processing...' : 'Find Talent'}
                </Button>
              </div>

              {!showFreelancerIdInput && (
                  <div className="text-center mt-3">
                      <button
                          type="button"
                          onClick={() => setShowFreelancerIdInput(true)}
                          className="text-sm text-muted-foreground hover:text-primary hover:underline focus:outline-none focus:text-primary focus:underline"
                      >
                          Have a specific freelancer ID? Click here
                      </button>
                  </div>
              )}
              
              <div className={cn(
                  "transition-all duration-200 ease-out overflow-hidden pt-2", 
                  showFreelancerIdInput ? "max-h-40 opacity-100 mt-4" : "max-h-0 opacity-0"
              )}>
                <FormField
                  control={form.control}
                  name="freelancerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="freelancerId">
                        Freelancer ID (Optional)
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                           <Input
                             id="freelancerId"
                             ref={freelancerIdInputRef}
                             {...field}
                             placeholder="Enter ID if known"
                           />
                           {field.value && (
                             <Button
                               type="button"
                               variant="ghost"
                               size="icon"
                               className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                               onClick={() => form.setValue('freelancerId', '')}
                             >
                               <X className="h-4 w-4" />
                             </Button>
                           )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {matchResult && !isMatching && !error && (
                <Alert
                  variant={matchResult.status === 'matched' ? 'default' : 'default'}
                  className="mt-4 border-l-4 border-primary bg-primary/5"
                >
                    <AlertTitle className="font-semibold">
                      {matchResult.status === 'matched' ? 'Match Found!' : 'Estimate Ready'}
                    </AlertTitle>
                  <AlertDescription>
                      {matchResult.reasoning}
                      {renderResultDetails}
                   </AlertDescription>
                </Alert>
              )}

              {isMatching && !error && !matchResult && (
                   <div className="mt-4 text-center text-muted-foreground">
                       <p>Finding the best matches...</p>
                   </div>
               )}

               {error && !isMatching && (
                  <Alert variant="destructive" className="mt-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                  </Alert>
              )}

            </CardContent>
          </form>
        </Form>

        <Dialog open={isIdeaChatOpen} onOpenChange={setIsIdeaChatOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" /> AI Project Example Generator
              </DialogTitle>
              <DialogDescription>AI suggestions for example project briefs.</DialogDescription>
            </DialogHeader>
            <div className="py-4 min-h-[100px] flex items-center justify-center">
              {ideaLoading && (
                  <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Generating example...</p>
                  </div>
              )}
              {ideaError && (
                  <Alert variant="destructive">
                       <AlertCircle className="h-4 w-4" />
                       <AlertTitle>Error Generating Example</AlertTitle>
                      <AlertDescription>{ideaError}</AlertDescription>
                  </Alert>
              )}
              {generatedIdea && !ideaLoading && !ideaError && (
                <Card className="w-full bg-muted/50 p-4">
                  <h4 className="font-semibold text-lg mb-1">{generatedIdea.idea}</h4>
                   {generatedIdea.details && <p className="text-sm text-muted-foreground mb-3">{generatedIdea.details}</p>}
                   <div className="text-xs space-y-1">
                        <p><Calendar className="inline h-3 w-3 mr-1"/> Timeline: {generatedIdea.estimatedTimeline}</p>
                        <p><Hourglass className="inline h-3 w-3 mr-1"/> Hours: ~{generatedIdea.estimatedHours ?? 'N/A'}</p>
                         {generatedIdea.requiredSkills && generatedIdea.requiredSkills.length > 0 && (
                             <div className="flex flex-wrap gap-1 items-center">
                                 <Tag className="inline h-3 w-3 mr-1"/> Skills:
                                 {generatedIdea.requiredSkills.map(skill => <Badge key={skill} variant="secondary">{skill}</Badge>)}
                             </div>
                         )}
                         {generatedIdea.totalCostToClient != null && (
                           <p><DollarSign className="inline h-3 w-3 mr-1"/> Est. Cost: ~${generatedIdea.totalCostToClient.toFixed(2)}</p>
                         )}
                   </div>

                </Card>
              )}
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              {generatedIdea && !ideaLoading && !ideaError && (
                <Button
                   onClick={() => {
                     form.setValue('projectBrief', `${generatedIdea.idea}: ${generatedIdea.details ?? ''}`);
                     setIsIdeaChatOpen(false);
                     toast({ title: "Example Applied", description: "The example brief has been added to the form." });
                   }}
                   className="w-full sm:w-auto"
                 >
                   Use This Example
                 </Button>
              )}
               <Button
                 variant="outline"
                 onClick={handleGenerateIdea}
                 disabled={ideaLoading || ideaGenerationCounter >= 3}
                 className="w-full sm:w-auto"
               >
                 <Wand2 className="mr-2 h-4 w-4" />
                 Regenerate {ideaGenerationCounter > 0 ? `(${ideaGenerationCounter}/3)` : ''}
               </Button>
              <Button variant="secondary" onClick={() => setIsIdeaChatOpen(false)} className="w-full sm:w-auto">Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    </div>
  );
});

AiMatcher.displayName = "AiMatcher";

