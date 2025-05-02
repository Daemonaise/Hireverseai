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
  projectBrief: z.string().min(20, { message: "Please describe your project in detail (minimum 20 characters)." }).max(2000, { message: "Project brief cannot exceed 2000 characters." }),
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
         title: "Example Limit Reached",
         description: "You have reached the maximum number of example generations for this session.",
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
       console.log("Generating project idea example...");
       // Pass a hint to get varied examples if desired
       const result = await generateProjectIdea(); // Removed hint for simplicity
       console.log("AI Idea Generation Result:", result);
       if (result.status === 'error') {
         // Use the error reasoning provided by the flow, or a specific message
         const errorMessage = result.reasoning || `Failed to generate example: Invalid response from AI.`;
         setIdeaError(errorMessage); // Set the error state to display in the dialog
         console.error("Error generating example:", result.reasoning);
         // No need for toast here, error is shown in dialog
         // toast({ title: "Error Generating Idea", description: errorMessage, variant: "destructive" });
       } else {
         setGeneratedIdea(result);
       }
    } catch (err: any) {
       console.error('Error in handleGenerateIdea:', err);
       // Set the error state with the caught error message
       const errorDetails = err.errors ? JSON.stringify(err.errors) : '';
       const errorMessage = `${err.message || "An unexpected error occurred while generating the example."} ${errorDetails}`;
       setIdeaError(errorMessage); // Set the error state to display in the dialog
       // No need for toast here, error is shown in dialog
       // toast({ title: "Error Generating Idea", description: errorMessage, variant: "destructive" });
    } finally {
       setIdeaLoading(false);
    }
  }, [ideaGenerationCounter, toast, form]); // Added form dependency


  const onSubmit = useCallback((values: FormSchema) => {
    setError(null);
    setMatchResult(null);
    setIsMatching(true); // Set matching state to true
    const { isAuthenticated, userId } = checkAuthentication();

    if (!isAuthenticated) {
      toast({ title: "Authentication Required", description: "Please login or sign up to match freelancers.", variant: "destructive" });
      setIsMatching(false);
      // TODO: Optionally open login/signup modal here
      return;
    }

    // Show immediate feedback
     toast({
       title: "Matching Freelancers...",
       description: "Please wait while we find the best talent for your project.",
       duration: 3000, // Show for 3 seconds while transition runs
     });


    startTransition(async () => {
      try {
        console.log("Matching freelancers for brief:", values.projectBrief.substring(0, 50) + "...");
        // Pass client ID if authenticated, otherwise undefined
        const flowInput = { projectBrief: values.projectBrief, freelancerId: userId ?? undefined };
        const result = await matchFreelancer(flowInput);
        setMatchResult(result); // Set result after AI call completes

        // Clear the initial "Matching..." toast if it's still showing
        // toast.dismiss(); // Need a way to dismiss specific toasts if using a library that supports it

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
        setIsMatching(false); // Ensure loading state is turned off after transition completes
        // Optionally show placeholder if no result after loading
        // if (!matchResult && !error) {
        //    toast({ title: "Still Working...", description: "Matches are coming soon!", duration: 4000 });
        // }
      }
    });
  }, [toast, router, matchResult]); // Added matchResult dependency for cleanup logic

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
                <FormItem className="relative text-center">
                  <FormLabel
                    htmlFor="projectBrief"
                    className={cn(
                      "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-muted-foreground transition-all duration-200 ease-out pointer-events-none",
                      "peer-focus:top-2 peer-focus:left-3 peer-focus:translate-x-0 peer-focus:-translate-y-0 peer-focus:text-xs peer-focus:text-primary",
                      (field.value || form.formState.isSubmitted) && "top-2 left-3 translate-x-0 -translate-y-0 text-xs text-primary"
                    )}
                  >
                    Describe your project goal, key deliverables, and any specific requirements...
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      id="projectBrief"
                      {...field}
                      placeholder=" " // Use space placeholder for floating label effect
                      className="min-h-[120px] max-h-[250px] pt-5 resize-y mx-auto border-2 border-input focus:border-primary peer" // Ensure 'peer' class is present
                      onFocus={(e) => {
                        const label = e.target.previousElementSibling as HTMLLabelElement;
                        if (label) {
                           label.classList.add("top-2", "left-3", "translate-x-0", "-translate-y-0", "text-xs", "text-primary");
                           label.classList.remove("top-1/2", "left-1/2", "-translate-x-1/2", "-translate-y-1/2", "text-muted-foreground");
                        }
                      }}
                      onBlur={(e) => {
                         const label = e.target.previousElementSibling as HTMLLabelElement;
                         if (label && !field.value) {
                           label.classList.remove("top-2", "left-3", "translate-x-0", "-translate-y-0", "text-xs", "text-primary");
                           label.classList.add("top-1/2", "left-1/2", "-translate-x-1/2", "-translate-y-1/2", "text-muted-foreground");
                         }
                      }}
                    />
                  </FormControl>
                  <FormMessage className="text-center" />
                </FormItem>
              )}
            />

             {/* "Need an example?" Button Centered */}
            <div className="text-center pt-2">
              <Button
                 variant="outline"
                 size="sm"
                 type="button" // Important: prevent form submission
                 onClick={handleGenerateIdea}
                 disabled={ideaLoading || ideaGenerationCounter >= 3}
                 className="mx-auto" // Center the button
               >
                <Wand2 className="mr-2 h-4 w-4" /> Need an example?
              </Button>
            </div>


            {/* Freelancer ID Input (conditionally rendered) */}
            <div className={cn(
                "transition-all duration-200 ease-out overflow-hidden",
                showFreelancerIdInput ? "max-h-40 opacity-100 mt-4" : "max-h-0 opacity-0"
            )}>
              <FormField
                control={form.control}
                name="freelancerId"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormLabel
                      htmlFor="freelancerId"
                      className={cn(
                        "absolute left-3 top-2 text-muted-foreground transition-all duration-200 ease-out pointer-events-none",
                        "peer-placeholder-shown:top-2 peer-placeholder-shown:text-base", // Adjusted initial state
                        "peer-focus:top-[-0.7rem] peer-focus:text-xs peer-focus:text-primary",
                         field.value && "top-[-0.7rem] text-xs text-primary"
                      )}
                    >
                      Freelancer ID (Optional)
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                         <Input
                           id="freelancerId"
                           ref={freelancerIdInputRef}
                           {...field}
                           placeholder=" "
                           className="pt-4 peer" // Ensure peer class is present
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

            {/* Toggle Freelancer ID Input Link */}
            {!showFreelancerIdInput && (
                <div className="text-center mt-3"> {/* Added margin-top */}
                    <button
                        type="button"
                        onClick={() => setShowFreelancerIdInput(true)}
                        className="text-sm text-muted-foreground hover:text-primary hover:underline focus:outline-none focus:text-primary focus:underline"
                    >
                        Have a specific freelancer ID? Click here
                    </button>
                </div>
            )}

            {/* Match Freelancers Button Centered */}
            <div className="text-center pt-4"> {/* Adjusted padding */}
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
            {matchResult && !isMatching && !error && ( // Show only when not matching and no error
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

            {/* Placeholder while loading/matching and no error */}
            {isMatching && !error && !matchResult && (
                 <div className="mt-4 text-center text-muted-foreground">
                     <p>Finding the best matches...</p>
                     {/* Optional: Add a placeholder message if it takes longer */}
                     {/* <p className="text-xs mt-1">(This may take a few moments)</p> */}
                 </div>
             )}


             {/* Error Display */}
             {error && !isMatching && ( // Show error only when not matching
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
                    {/* Directly display the error message from the state */}
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
                   // Set project brief
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
  );
}
