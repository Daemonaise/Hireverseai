
'use client';

import React, { useState, useTransition, useRef, useEffect, useCallback, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Info, Clock, DollarSign, Layers, Check, X, ChevronDown, ChevronUp, FileText, AlertCircle, Loader2, HelpCircle, Wand2, MessageSquare, Bot, Calendar, Tag, Hourglass } from 'lucide-react'; // Added icons
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'; // Added Dialog
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { matchFreelancer, type MatchFreelancerOutput, type MatchFreelancerInput } from '@/ai/flows/match-freelancer';
import { generateProjectIdea, type GenerateProjectIdeaOutput } from '@/ai/flows/generate-project-idea'; // Import new flow
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// Schema for the form
const formSchema = z.object({
  projectBrief: z.string().min(20, {
    message: 'Project brief must be at least 20 characters.',
  }).max(2000, {
    message: 'Project brief cannot exceed 2000 characters.',
  }),
  freelancerId: z.string().optional(), // Used for user-specific model lookup context
});

type FormSchema = z.infer<typeof formSchema>;

// Placeholder for actual authentication check (replace with your auth logic)
const checkAuthentication = (): { isAuthenticated: boolean; userId: string | null } => {
    // TODO: Implement real authentication logic (e.g., check session, token, context)
    console.log("Running placeholder authentication check...");
    const isAuthenticated = true; // Simulate authenticated state
    const userId = isAuthenticated ? 'test-client-001' : null; // Placeholder client ID
    console.log("Auth Check Result:", { isAuthenticated, userId });
    return { isAuthenticated, userId };
};


export function AiMatcher() {
  const [isPending, startTransition] = useTransition();
  const [matchResult, setMatchResult] = useState<MatchFreelancerOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFreelancerIdInput, setShowFreelancerIdInput] = useState(false);
  const freelancerIdInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const router = useRouter(); // Initialize router
  const [isMatching, setIsMatching] = useState(false); // New state for immediate feedback

  // State for the idea generation chatbox
  const [isIdeaChatOpen, setIsIdeaChatOpen] = useState(false);
  const [generatedIdea, setGeneratedIdea] = useState<GenerateProjectIdeaOutput | null>(null);
  const [ideaLoading, setIdeaLoading] = useState(false);
  const [ideaError, setIdeaError] = useState<string | null>(null);


  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      projectBrief: '',
      freelancerId: '',
    },
    mode: 'onChange', // Validate on change for better UX
  });

   // Focus input when it appears
  useEffect(() => {
    if (showFreelancerIdInput && freelancerIdInputRef.current) {
      freelancerIdInputRef.current.focus();
    }
  }, [showFreelancerIdInput]);

  // --- Handle AI Idea Generation ---
  const handleGenerateIdea = useCallback(async () => {
     setIsIdeaChatOpen(true);
     setIdeaLoading(true);
     setIdeaError(null);
     setGeneratedIdea(null);

     try {
         console.log("Requesting project idea from AI...");
         const result = await generateProjectIdea({}); // Pass empty object or specific input if needed
         console.log("AI Idea Generation Result:", result);
         if (result.status === 'error') {
             throw new Error(result.reasoning || "Failed to generate idea.");
         }
         setGeneratedIdea(result);
     } catch (err: any) {
         console.error('Error generating project idea:', err);
         const message = err.message?.includes('API key')
             ? `Error generating idea: Invalid or missing API Key. ${err.message}`
             : err.message || 'An unexpected error occurred while generating the idea.';
         setIdeaError(message);
     } finally {
         setIdeaLoading(false);
     }
 }, []);

 // --- Handle Form Submission ---
  const onSubmit = useCallback((values: FormSchema) => {
    setError(null);
    setMatchResult(null); // Clear previous results
    setIsMatching(true); // Set matching state immediately

    // --- 1. Authentication Check ---
    const { isAuthenticated, userId } = checkAuthentication();

    if (!isAuthenticated) {
        toast({
            title: "Authentication Required",
            description: "Please log in or sign up to submit a project.",
            variant: "destructive",
            duration: 5000,
        });
        // TODO: Implement proper auth flow (e.g., redirect to login or show modal)
        // router.push('/client/login'); // Example redirect
        console.warn("User not authenticated. Stopping project submission.");
        setIsMatching(false); // Clear matching state on auth failure
        return; // Stop submission
    }

    // --- 2. Proceed with Matching if Authenticated ---
    startTransition(async () => {
      try {
        const flowInput: MatchFreelancerInput = {
          projectBrief: values.projectBrief,
          // requiredSkills: [], // Let the flow extract skills
          // Pass the authenticated user ID (could be client or freelancer) for potential model personalization check
          freelancerId: userId ?? undefined, // Use authenticated user ID for context if available
          // projectId: undefined, // Not applicable for initial match
        };

        console.log("Calling matchFreelancer flow with input:", flowInput);
        const result = await matchFreelancer(flowInput);
        console.log("matchFreelancer flow result:", result);

        setMatchResult(result); // Update state with the result

        // Handle different result statuses
        let toastTitle = 'Processing Complete';
        let toastDescription = 'Analysis finished.';
        let toastVariant: 'default' | 'destructive' | 'success' = 'default'; // Added 'success' variant
        let shouldRedirect = false;

        switch (result.status) {
            case 'matched':
                toastTitle = 'Match Found & Estimated!';
                toastDescription = result.reasoning || 'AI has matched a freelancer and estimated the project.';
                toastVariant = 'success'; // Use success variant for matches
                // Redirect to checkout page on match
                // Use dummy project ID if matchedFreelancerId is missing (error case handled separately)
                const checkoutProjectId = result.matchedFreelancerId ?? `error_${Date.now()}`;
                 router.push(`/checkout?projectId=${checkoutProjectId}&cost=${result.totalCostToClient ?? 0}`);
                return; // Stop further processing here after redirect initiated
            case 'no_available_freelancer':
            case 'estimation_only':
                toastTitle = 'Estimation Complete';
                toastDescription = result.reasoning || 'Project scope estimated. No available freelancers found at this moment.';
                toastVariant = 'default';
                // Optionally redirect to dashboard even without a match to show estimate
                // shouldRedirect = true;
                break;
            case 'error':
                toastTitle = 'Error';
                toastDescription = result.reasoning || 'An unexpected error occurred during matching.';
                toastVariant = 'destructive';
                setError(toastDescription); // Set error state for display in component
                break;
            default:
                console.warn("Received unexpected match status:", result.status);
                toastDescription = result.reasoning || 'Received an unexpected response status.';
                toastVariant = 'default';
        }

        toast({ title: toastTitle, description: toastDescription, variant: toastVariant, duration: 5000 });

         // --- 3. Redirect to Client Dashboard on Success (if applicable and NOT already redirected) ---
         // This part might be redundant now if redirect happens on 'matched' case directly
         if (shouldRedirect && userId) {
             console.log(`Redirecting user ${userId} to client dashboard...`);
             // TODO: Pass necessary project info (e.g., new project ID if created) via state or query params if needed
             // For now, assume dashboard fetches projects based on authenticated user context
             router.push(`/client/dashboard`);
         } else if (shouldRedirect && !userId) {
             console.warn("Successful match but no userId found for redirection.");
         }

      } catch (err: any) {
        console.error('Error in matchFreelancer transition:', err);
        // Check if the error is likely due to API key issues
        const message = err.message?.includes('API key')
            ? `Failed to process project brief: Invalid or missing API Key. ${err.message}`
            : err.message || 'Failed to process project brief. Please try again.';
        setError(message);
        setMatchResult({ reasoning: message, status: 'error' }); // Set result state to error
        toast({ title: 'Submission Error', description: message, variant: 'destructive' });
      } finally {
        setIsMatching(false); // Clear matching state after processing
      }
    });
  }, [toast, router]); // useCallback dependencies


  // --- Memoized Result Display Logic ---
   const renderResultDetails = useMemo(() => {
       if (!matchResult || matchResult.status === 'error') return null;

        // Define common style for icons
        const iconStyle = "h-4 w-4 text-muted-foreground shrink-0";

       return (
         <div className="mt-3 space-y-3 text-sm">
            {/* Timeline */}
           {matchResult.estimatedTimeline && (
             <div className="flex items-center gap-2">
               <Clock className={iconStyle} />
               <span>Est. Timeline: <span className="font-medium text-foreground">{matchResult.estimatedTimeline}</span></span>
             </div>
           )}

            {/* Estimated Hours */}
           {matchResult.estimatedHours != null && matchResult.estimatedHours > 0 && ( // Display if positive number
                <div className="flex items-center gap-2">
                   <Hourglass className={iconStyle} />
                   <span>Est. Hours: <span className="font-medium text-foreground">{matchResult.estimatedHours}</span></span>
                </div>
            )}

            {/* Extracted Skills */}
           {matchResult.extractedSkills && matchResult.extractedSkills.length > 0 && (
             <div className="flex items-start gap-2 pt-1">
               <Info className={`${iconStyle} mt-0.5`} />
               <div className="flex flex-wrap gap-1 items-center">
                 <span className="font-medium mr-1 text-foreground shrink-0">Identified Skills:</span>
                 {matchResult.extractedSkills.map(skill => (
                   <Badge key={skill} variant="secondary" className="text-xs font-normal">{skill}</Badge>
                 ))}
               </div>
             </div>
           )}

            {/* Cost Breakdown */}
           {(matchResult.estimatedBaseCost || matchResult.platformFee || matchResult.totalCostToClient) && (
             <div className="mt-4 pt-3 border-t border-border/50">
               <h4 className="text-sm font-semibold mb-2 text-foreground">Cost Estimate:</h4>
               <div className="space-y-1.5">
                 {matchResult.estimatedBaseCost != null && ( // Check for null/undefined explicitly
                   <div className="flex justify-between items-center">
                     <span className="text-muted-foreground">Freelancer Payout:</span>
                     <span className="font-medium text-foreground">${matchResult.estimatedBaseCost.toFixed(2)}</span>
                   </div>
                 )}
                 {matchResult.platformFee != null && (
                   <div className="flex justify-between items-center">
                     <span className="text-muted-foreground flex items-center gap-1">
                       <Layers className="h-3 w-3" /> Platform Fee (15%):
                     </span>
                     <span className="font-medium text-foreground">+ ${matchResult.platformFee.toFixed(2)}</span>
                   </div>
                 )}
                 <Separator className="my-1.5 bg-border/70" />
                 {matchResult.totalCostToClient != null && (
                   <div className="flex justify-between items-center font-semibold text-foreground">
                     <span>Total Client Cost:</span>
                     <span className="flex items-center gap-1">
                       <DollarSign className="h-4 w-4" />
                       ${matchResult.totalCostToClient.toFixed(2)} USD
                     </span>
                   </div>
                 )}
               </div>
               <p className="text-xs text-muted-foreground mt-2.5">
                   *Platform Fee covers AI matching, QA, hosting, and operations. Freelancers receive the full Payout amount.
               </p>
             </div>
           )}
         </div>
       );
   }, [matchResult]);

  const resultAlertVariant = useMemo(() => {
      switch (matchResult?.status) {
          case 'matched': return 'success'; // Use a potential success variant
          case 'no_available_freelancer':
          case 'estimation_only': return 'default';
          default: return 'default'; // Default for no result or other statuses
      }
  }, [matchResult?.status]);

  const resultAlertIcon = useMemo(() => {
      switch (matchResult?.status) {
          case 'matched': return <Check className="h-4 w-4 text-green-600" />; // Green check for success
          case 'no_available_freelancer':
          case 'estimation_only': return <Info className="h-4 w-4 text-blue-600" />; // Blue info icon
          default: return <Info className="h-4 w-4 text-muted-foreground" />;
      }
  }, [matchResult?.status]);

  const resultAlertTitle = useMemo(() => {
      switch (matchResult?.status) {
          case 'matched': return 'Match Found & Estimated!';
          case 'no_available_freelancer': return 'Estimation Complete (No Match Found)';
          case 'estimation_only': return 'Estimation Complete';
          default: return 'Processing Result';
      }
  }, [matchResult?.status]);

  return (
     <> {/* Added Fragment */}
    <Card className="w-full shadow-md">
      <Form {...form}>
        {/* Use a standard form element */}
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-0">
          <CardContent className="flex flex-col items-center pt-6 space-y-4"> {/* Added pt-6 and space-y-4 */}

            {/* Project Brief Textarea */}
            <FormField
              control={form.control}
              name="projectBrief"
              render={({ field }) => (
                <FormItem className="relative w-full max-w-xl">
                   {/* Floating Label - Position controlled by peer-placeholder-shown */}
                   <FormLabel
                       htmlFor="projectBrief"
                       className={cn(
                         'absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-10 origin-[0] px-2 text-sm text-muted-foreground duration-200 pointer-events-none',
                         // When placeholder is not shown (input focused or has value), move label up
                         'peer-focus:left-3 peer-focus:top-[0.8rem] peer-focus:translate-x-0 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:bg-background peer-focus:text-primary', // Float up on focus
                         field.value && 'left-3 top-[0.8rem] translate-x-0 -translate-y-4 scale-75 bg-background text-primary' // Keep floated if value exists
                       )}
                  >
                     Describe your project goal...
                   </FormLabel>
                  <FormControl>
                    <Textarea
                      id="projectBrief"
                      placeholder=" " // Use space for floating label effect
                      className="min-h-[120px] resize-none border-2 border-input focus:border-primary transition-colors" // Adjusted height, thicker border
                      {...field}
                      aria-label="Project Brief Description"
                    />
                  </FormControl>
                  <FormMessage className="text-xs pt-1 text-center" />
                </FormItem>
              )}
            />

             {/* "Need an idea?" Button */}
             <div className="w-full max-w-xl text-center mt-2 mb-3 flex justify-center">
                 {/* Idea Generation Link */}
                 <button
                    type="button"
                    onClick={handleGenerateIdea}
                    className="text-sm text-muted-foreground hover:text-primary hover:underline focus:outline-none focus:text-primary focus:underline inline-flex items-center gap-1"
                    >
                    <Wand2 className="h-4 w-4" />
                     Need an idea?
                 </button>
             </div>

            {/* Freelancer ID Toggle and Input */}
            <div className="w-full max-w-xl flex flex-col items-center pt-2"> {/* Added pt-2 */}
               {!showFreelancerIdInput && (
                  <button
                    type="button"
                    onClick={() => setShowFreelancerIdInput(true)}
                    className="text-sm text-muted-foreground hover:text-primary hover:underline focus:underline focus:outline-none mt-2 mb-4 inline-flex items-center gap-1" // Use primary color on hover/focus
                    aria-expanded={showFreelancerIdInput}
                  >
                     Have a specific freelancer ID? Click here
                     <ChevronDown className="inline-block ml-1 h-4 w-4 transition-transform duration-200"/>
                  </button>
                )}

                {showFreelancerIdInput && (
                  <div className="w-full">
                     <FormField
                        control={form.control}
                        name="freelancerId"
                        render={({ field }) => (
                            <FormItem className="relative mb-4">
                                <FormLabel
                                    htmlFor="freelancerId"
                                    className={cn(
                                        'absolute left-3 top-3 z-10 origin-[0] -translate-y-4 scale-75 transform text-sm text-muted-foreground duration-200 pointer-events-none',
                                        !field.value && 'peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100', // Show label inside when empty
                                        'peer-focus:left-3 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:text-primary'
                                     )}
                                >
                                    Freelancer ID (Optional)
                                </FormLabel>
                                <FormControl>
                                     <div className="relative">
                                        <Input
                                            id="freelancerId"
                                            ref={freelancerIdInputRef}
                                            placeholder=" " // Use space for floating label effect
                                            className="pt-4 pr-8" // Adjusted padding
                                            {...field}
                                            aria-label="Optional Freelancer ID"
                                        />
                                        {field.value && (
                                             <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon" // Made button square
                                                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                                onClick={() => {
                                                    form.setValue('freelancerId', '');
                                                    freelancerIdInputRef.current?.focus(); // Keep focus after clearing
                                                }}
                                                aria-label="Clear Freelancer ID"
                                             >
                                                <X className="h-4 w-4" />
                                             </Button>
                                        )}
                                     </div>
                                </FormControl>
                                <FormMessage className="text-xs pt-1" />
                            </FormItem>
                        )}
                    />
                     <button
                        type="button"
                        onClick={() => setShowFreelancerIdInput(false)}
                        className="text-sm text-primary hover:underline focus:underline focus:outline-none mb-4"
                        aria-expanded={showFreelancerIdInput}
                      >
                        Hide Freelancer ID Input
                        <ChevronUp className="inline-block ml-1 h-4 w-4 transition-transform duration-200"/>
                     </button>
                  </div>
                 )}
             </div>

            {/* Match Button */}
             <div className="w-full flex justify-center pt-2">
                <Button
                    type="submit"
                    disabled={isPending || isMatching || !form.formState.isValid} // Disable during matching too
                    className={cn(
                      "h-10 rounded-md w-full max-w-[300px] relative overflow-hidden", // max-w-xs approx 320px, using 300px
                      "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2",
                      "hover:bg-primary/90 transition-colors duration-200"
                    )}
                    style={{ borderRadius: '6px' }} // Ensure consistent border radius
                  >
                    {(isPending || isMatching) && ( // Show loader if pending or matching
                       <div className="absolute inset-0 flex items-center justify-center bg-primary/80 pointer-events-none"> {/* Added pointer-events-none */}
                           <Loader2 className="h-5 w-5 animate-spin text-primary-foreground" /> {/* Made loader slightly larger */}
                      </div>
                    )}
                    <span className={cn("transition-opacity", (isPending || isMatching) ? 'opacity-0' : 'opacity-100')}>
                       Match Freelancers
                    </span>
                  </Button>
            </div>

            {/* Results Area */}
            {(matchResult || error) && !isPending && !isMatching && ( // Show result/error only when not pending or matching
              <div className="pt-4 w-full max-w-xl">
                <Separator className="mb-4" />
                {error && (
                  <Alert variant="destructive" className="w-full">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                {matchResult && !error && (
                     <Alert
                         variant={resultAlertVariant as any} // Cast as any if 'success' is not standard
                         className={cn(
                            "w-full",
                            resultAlertVariant === 'success' && "border-green-300 bg-green-50 text-green-900 dark:border-green-700 dark:bg-green-950 dark:text-green-100 [&>svg]:text-green-600", // Custom success styling
                            resultAlertVariant === 'default' && "bg-blue-50 border-blue-300 text-blue-900 dark:bg-blue-950 dark:border-blue-700 dark:text-blue-100 [&>svg]:text-blue-600" // Custom info styling
                         )}
                     >
                         <div className="flex items-start gap-3">
                            <div className="mt-0.5">{resultAlertIcon}</div>
                            <div className="flex-1">
                               <AlertTitle className="font-semibold">{resultAlertTitle}</AlertTitle>
                               <AlertDescription className="mt-1">
                                  <p className="mb-2">{matchResult.reasoning}</p>
                                  {matchResult.status === 'matched' && matchResult.matchedFreelancerId && (
                                    <p className="text-xs font-medium text-muted-foreground">Matched Freelancer ID: {matchResult.matchedFreelancerId}</p>
                                  )}
                                  {renderResultDetails}
                               </AlertDescription>
                            </div>
                         </div>
                       </Alert>
                     )}
              </div>
            )}
              {isMatching && !matchResult && !error && (
                 <div className="pt-4 w-full max-w-xl">
                   <Separator className="mb-4" />
                    <div className="flex items-center justify-center text-muted-foreground">
                         <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                         <span>Matching Freelancers...</span>
                    </div>
                    <p className="mt-2 text-center text-sm text-muted-foreground">Your matches are coming soon!</p>
                 </div>
              )}
          </CardContent>
        </form>
      </Form>
    </Card>

     {/* Idea Generation Chatbox Dialog */}
     <Dialog open={isIdeaChatOpen} onOpenChange={setIsIdeaChatOpen}>
       <DialogContent className="sm:max-w-md">
         <DialogHeader>
           <DialogTitle className="flex items-center gap-2"><Bot className="h-5 w-5" /> AI Project Idea Generator</DialogTitle>
           <DialogDescription>Let our AI suggest a project idea for you, complete with estimates.</DialogDescription>
         </DialogHeader>
          <div className="py-4 space-y-4">
             {ideaLoading && (
               <div className="flex justify-center items-center py-8">
                 <Loader2 className="h-8 w-8 animate-spin text-primary" />
                 <span className="ml-2 text-muted-foreground">Generating idea...</span>
               </div>
             )}
             {ideaError && (
               <Alert variant="destructive">
                 <AlertCircle className="h-4 w-4" />
                 <AlertTitle>Error</AlertTitle>
                 <AlertDescription>{ideaError}</AlertDescription>
                 <Button variant="outline" size="sm" onClick={handleGenerateIdea} className="mt-3">Retry</Button>
               </Alert>
             )}
              {generatedIdea && (
                 <div className="space-y-4 text-sm">
                    <h4 className="font-semibold text-base">{generatedIdea.idea}</h4>
                    {generatedIdea.details && <p className="text-muted-foreground">{generatedIdea.details}</p>}
                    <Separator />
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                       <div className="flex items-center gap-1.5 text-muted-foreground">
                         <Calendar className="h-4 w-4" /> Estimated Timeline:
                       </div>
                       <div className="font-medium text-right">{generatedIdea.estimatedTimeline || 'N/A'}</div>

                       {/* Display Estimated Hours */}
                       {generatedIdea.estimatedHours && generatedIdea.estimatedHours > 0 && (
                          <>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Hourglass className="h-4 w-4" /> Estimated Hours:
                            </div>
                            <div className="font-medium text-right">{generatedIdea.estimatedHours}</div>
                          </>
                       )}

                       <div className="flex items-center gap-1.5 text-muted-foreground">
                         <DollarSign className="h-4 w-4" /> Base Cost:
                       </div>
                       <div className="font-medium text-right">${generatedIdea.estimatedBaseCost?.toFixed(2) ?? 'N/A'}</div>

                        <div className="flex items-center gap-1.5 text-muted-foreground">
                         <Layers className="h-4 w-4" /> Platform Fee (15%):
                       </div>
                       <div className="font-medium text-right">+ ${generatedIdea.platformFee?.toFixed(2) ?? 'N/A'}</div>

                       <div className="flex items-center gap-1.5 text-muted-foreground">
                         <Tag className="h-4 w-4" /> Total Client Cost:
                       </div>
                       <div className="font-semibold text-foreground text-right">${generatedIdea.totalCostToClient?.toFixed(2) ?? 'N/A'}</div>

                        <div className="flex items-center gap-1.5 text-muted-foreground">
                         <DollarSign className="h-4 w-4" /> Monthly Cost*:
                       </div>
                       <div className="font-medium text-right">${generatedIdea.monthlySubscriptionCost?.toFixed(2) ?? 'N/A'} <span className="text-xs text-muted-foreground">/mo</span></div>
                    </div>
                    <p className="text-xs text-muted-foreground pt-2">*Monthly cost is estimated based on a typical subscription timeframe and the project's nature.</p>
                 </div>
              )}
          </div>
         <DialogFooter className="sm:justify-start">
             {generatedIdea && (
                 <Button
                     onClick={() => {
                         form.setValue('projectBrief', generatedIdea.idea + (generatedIdea.details ? `\n\n${generatedIdea.details}` : ''));
                         setIsIdeaChatOpen(false);
                         toast({title: "Idea Copied!", description: "Project brief updated with the generated idea."});
                     }}
                     size="sm"
                 >
                     Use This Idea
                 </Button>
             )}
           <Button type="button" variant="secondary" size="sm" onClick={() => setIsIdeaChatOpen(false)}>
             Close
           </Button>
         </DialogFooter>
       </DialogContent>
     </Dialog>
     </> // Close Fragment
  );
}
