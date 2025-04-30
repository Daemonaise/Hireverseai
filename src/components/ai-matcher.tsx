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
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  projectBrief: z.string().min(20, { message: "Please describe your project (minimum 20 characters)." }).max(2000, { message: "Project brief cannot exceed 2000 characters." }),
  freelancerId: z.string().optional(),
});

type FormSchema = z.infer<typeof formSchema>;

// Placeholder: Replace with actual authentication check from context or session
const checkAuthentication = (): { isAuthenticated: boolean; userId: string | null } => {
  // For demo: Assume authenticated if a certain condition is met, else null.
  // In a real app, check for a valid session token, user context, etc.
  // return { isAuthenticated: false, userId: null }; // Example: Not logged in
   return { isAuthenticated: true, userId: 'test-client-001' }; // Example: Logged in
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
    mode: 'onChange', // Validate on change for better UX
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
         title: "Idea Limit Reached",
         description: "You have reached the maximum number of idea generations for this session.",
         variant: "destructive",
       });
       setIdeaGenerationCounter(0); // Reset counter after warning
       return;
    }
    setIsIdeaChatOpen(true);
    setIdeaLoading(true);
    setIdeaError(null); // Clear previous errors
    setGeneratedIdea(null); // Clear previous idea

    try {
       console.log("Generating project idea...");
       const result = await generateProjectIdea(); // No input needed for now
       console.log("AI Idea Generation Result:", result);
       if (result.status === 'error') {
         // Use the error reasoning provided by the flow, or a specific message
         const errorMessage = result.reasoning || "Failed to generate or validate the project idea output: Missing or invalid fields in AI response.";
         // Set the error state instead of throwing
         setIdeaError(errorMessage);
       } else {
         setGeneratedIdea(result);
       }
    } catch (err: any) {
       console.error('Error in handleGenerateIdea:', err);
       // Set the error state with the caught error message
       const errorDetails = err.errors ? JSON.stringify(err.errors) : '';
       setIdeaError(`${err.message || "An unexpected error occurred while generating the idea."} ${errorDetails}`);
    } finally {
       setIdeaLoading(false);
    }
  }, [ideaGenerationCounter, toast]); // Added toast dependency


  const onSubmit = useCallback((values: FormSchema) => {
    setError(null);
    setMatchResult(null);
    setIsMatching(true);
    const { isAuthenticated, userId } = checkAuthentication();

    if (!isAuthenticated) {
      toast({ title: "Authentication Required", description: "Please login or sign up to match freelancers.", variant: "destructive" });
      setIsMatching(false);
      // TODO: Optionally open login/signup modal here
      return;
    }

    startTransition(async () => {
      try {
        console.log("Matching freelancers for brief:", values.projectBrief.substring(0, 50) + "...");
        // Pass client ID if authenticated, otherwise undefined
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
                variant: "default", // Use default or a specific 'info' variant if available
                duration: 5000,
            });
        } else if (result.status === 'matched' && result.totalCostToClient !== undefined && result.totalCostToClient > 0) {
            // Redirect to checkout only if matched AND cost is valid
            console.log("Match successful, redirecting to checkout...");
            toast({ title: "Match Found!", description: "Redirecting to payment...", variant: "default" }); // Changed variant to default
            // Ensure projectId is available for redirection, use a fallback or handle error if missing
             const checkoutProjectId = result.projectId || 'unknown_project'; // Use actual ID if available
            router.push(`/checkout?projectId=${checkoutProjectId}&cost=${result.totalCostToClient}`);
            return; // Exit after successful redirection start
        } else {
             // Handle other statuses or missing cost info
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
        setIsMatching(false); // Ensure loading state is turned off
      }
    });
  }, [toast, router]); // Added router dependency

  const renderResultDetails = useMemo(() => {
    if (!matchResult || matchResult.status === 'error') return null;
    const iconStyle = "h-4 w-4 text-muted-foreground shrink-0";

    return (
      <div className="mt-3 space-y-3 text-sm">
        {/* Display Timeline if available */}
        {matchResult.estimatedTimeline && (
          <div className="flex items-center gap-2">
            <Clock className={iconStyle} />
            <span>Est. Timeline: <span className="font-medium">{matchResult.estimatedTimeline}</span></span>
          </div>
        )}
        {/* Display Hours if available and positive */}
        {matchResult.estimatedHours != null && matchResult.estimatedHours > 0 && (
          <div className="flex items-center gap-2">
            <Hourglass className={iconStyle} />
            <span>Est. Hours: <span className="font-medium">{matchResult.estimatedHours}</span></span>
          </div>
        )}
        {/* Display Cost Breakdown if available */}
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
        {/* Display Skills if available */}
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
    <Card className="w-full shadow-md border-t-4 border-primary">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <CardContent className="pt-6 space-y-4">
            <FormField
              control={form.control}
              name="projectBrief"
              render={({ field }) => (
                <FormItem className="relative">
                  {/* Floating Label */}
                  <FormLabel
                    htmlFor="projectBrief"
                    className={cn(
                      "absolute left-3 top-2 text-muted-foreground transition-all duration-200 ease-out pointer-events-none", // Added pointer-events-none
                      "peer-placeholder-shown:top-2 peer-placeholder-shown:text-base", // Initial state (when placeholder is shown)
                      "peer-focus:top-[-0.7rem] peer-focus:text-xs peer-focus:text-primary", // State on focus
                       field.value && "top-[-0.7rem] text-xs text-primary" // State when value exists
                    )}
                  >
                    Project Brief
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      id="projectBrief"
                      {...field}
                      placeholder=" " // Use space as placeholder for floating label trick
                      className="min-h-[150px] pt-5 resize-y" // Added padding-top
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

             {/* "Need an Idea?" Button Centered */}
            <div className="text-center">
              <Button
                 variant="outline"
                 size="sm"
                 type="button" // Important: prevent form submission
                 onClick={handleGenerateIdea}
                 disabled={ideaLoading || ideaGenerationCounter >= 3}
                 className="mx-auto" // Center the button
               >
                <Wand2 className="mr-2 h-4 w-4" /> Need an idea?
              </Button>
            </div>

            {/* Match Freelancers Button Centered */}
            <div className="text-center pt-2">
              <Button
                type="submit"
                disabled={!form.formState.isValid || isPending || isMatching}
                className="w-full max-w-[300px] mx-auto" // Max width and centering
                size="lg"
              >
                {isPending || isMatching ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Matching...</>
                ) : (
                  "Match Freelancers"
                )}
              </Button>
            </div>

            {/* Result Display */}
            {matchResult && !error && (
              <Alert
                variant={matchResult.status === 'matched' ? 'default' : 'default'} // Changed variant to default
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

             {/* Error Display */}
             {error && (
                <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

          </CardContent>
        </form>
      </Form>

      {/* AI Idea Generator Dialog */}
      <Dialog open={isIdeaChatOpen} onOpenChange={setIsIdeaChatOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" /> AI Project Idea Generator
            </DialogTitle>
            <DialogDescription>AI suggestions for your next project idea.</DialogDescription>
          </DialogHeader>
          <div className="py-4 min-h-[100px] flex items-center justify-center">
            {ideaLoading && (
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Generating idea...</p>
                </div>
            )}
            {ideaError && (
                <Alert variant="destructive">
                     <AlertCircle className="h-4 w-4" />
                     <AlertTitle>Error Generating Idea</AlertTitle>
                    <AlertDescription>{ideaError}</AlertDescription>
                </Alert>
            )}
            {generatedIdea && !ideaLoading && !ideaError && (
              <Card className="w-full bg-muted/50 p-4">
                <h4 className="font-semibold text-lg mb-1">{generatedIdea.idea}</h4>
                 {generatedIdea.details && <p className="text-sm text-muted-foreground mb-3">{generatedIdea.details}</p>}
                 <div className="text-xs space-y-1">
                      <p><Calendar className="inline h-3 w-3 mr-1"/> Timeline: {generatedIdea.estimatedTimeline}</p>
                      <p><Hourglass className="inline h-3 w-3 mr-1"/> Hours: ~{generatedIdea.estimatedHours}</p>
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
                   // Set project brief and optionally skills
                   form.setValue('projectBrief', `${generatedIdea.idea}: ${generatedIdea.details ?? ''}`);
                   // Optionally pre-fill skills if the flow supports it
                   // form.setValue('requiredSkills', generatedIdea.requiredSkills);
                   setIsIdeaChatOpen(false);
                 }}
                 className="w-full sm:w-auto"
               >
                 Use This Idea
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
  );
}
