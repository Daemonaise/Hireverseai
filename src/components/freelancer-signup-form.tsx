'use client';

import { useState, useTransition, useCallback } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Loader2, CheckCircle, AlertCircle, Send, Eye, EyeOff, QrCode, BrainCircuit, UserPlus } from 'lucide-react'; // Added AlertCircle
import { useRouter } from 'next/navigation';           // ← Make sure this line is present
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { addFreelancer, storeUserMfaSecret, generateMfaSecret, updateFreelancerSkills } from '@/services/firestore'; // Import necessary functions
import { determinePrimarySkill, type DeterminePrimarySkillOutput } from '@/ai/flows/determine-primary-skill';
import { AdaptiveSkillAssessment } from '@/components/adaptive-skill-assessment';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { MfaSetup } from '@/components/mfa-setup'; // Import MFA setup component

// Keep skillsText optional here, validate in handleSkillsSubmit
const formSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters.' })
   .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter.' })
   .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter.' })
   .regex(/[0-9]/, { message: 'Password must contain at least one number.' })
   .regex(/[^a-zA-Z0-9]/, { message: 'Password must contain at least one special character.' }),
  confirmPassword: z.string(),
  skillsText: z.string().min(10, {message: 'Please describe your skills in at least 10 characters.'}).optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type FormSchema = z.infer<typeof formSchema>;


export function FreelancerSignupForm() {
  const [isPending, startTransition] = useTransition();
  const [isProcessing, setIsProcessing] = useState(false); // Combined loading state
  const [currentStep, setCurrentStep] = useState<'signup' | 'mfa' | 'skills' | 'assessment' | 'complete'>('signup');
  const [signupError, setSignupError] = useState<string | null>(null);
  const [freelancerId, setFreelancerId] = useState<string | null>(null);
  const [freelancerEmail, setFreelancerEmail] = useState<string | null>(null); // Store email for MFA URI
  const [primarySkill, setPrimarySkill] = useState<string | null>(null);
  const [allSkills, setAllSkills] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null); // Store generated MFA secret

  const { toast } = useToast();
  const router = useRouter(); // Initialize router

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      skillsText: '',
    },
     mode: "onChange",
  });

  const handleSignupSubmit = useCallback(async (values: FormSchema) => {
    console.log('handleSignupSubmit called with values:', values);
    setSignupError(null);
    setFreelancerId(null);
    setFreelancerEmail(null);
    setMfaSecret(null);
    setIsProcessing(true); // Start processing
    console.log('Starting signup transition...');

    startTransition(async () => {
      try {
        // --- TODO: Implement Real Authentication User Creation ---
        console.log("Simulating user creation for:", values.email);
        // Example: const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
        // const newUserId = userCredential.user.uid;
        const newUserId = `freelancer_${Date.now()}`; // Placeholder ID generation
        console.log("Simulated user creation successful, User ID:", newUserId);
        // --- End Placeholder ---

        // Add freelancer document to Firestore using the *actual* Auth User ID
        console.log(`Attempting to add freelancer ${newUserId} to Firestore...`);
        const newFreelancerId = await addFreelancer({
          id: newUserId, // Use the ID from the auth system
          name: values.name,
          email: values.email,
        });
        console.log(`Firestore document created with ID: ${newFreelancerId}`);

        // Generate and store MFA secret in the newly created Firestore document
        console.log("Generating MFA secret...");
        const secret = generateMfaSecret(); // Assuming this is synchronous or implicitly awaited
        console.log(`MFA Secret generated. Attempting to store for user ${newFreelancerId}...`);
        await storeUserMfaSecret(newFreelancerId, secret, 'freelancer'); // Pass the correct ID
        console.log("MFA secret stored successfully.");

        // Set state for the next step (MFA Setup)
        setFreelancerId(newFreelancerId);
        setFreelancerEmail(values.email); // Store email for QR code label
        setMfaSecret(secret); // Store the generated secret for the MfaSetup component

        // Immediately transition to MFA setup after successful signup.
        console.log("Signup successful, transitioning to MFA step.");
        setCurrentStep('mfa');
        toast({
          title: 'Account Created',
          description: 'Please set up Multi-Factor Authentication for security.',
          variant: 'default',
        });

      } catch (err: any) {
        console.error('Error during freelancer signup transition:', err);
        // Check for specific error types if needed (e.g., Firestore permission errors)
        let errorMessage = 'An unexpected error occurred during signup. Please try again.';
        if (err.code === 'permission-denied') { // Example specific Firestore error check
            errorMessage = 'Signup failed due to insufficient permissions. Please contact support.';
        } else if (err.message) {
            errorMessage = `Signup failed: ${err.message}`;
        }
        setSignupError(errorMessage);
        console.log(`Signup error set: ${errorMessage}`);
        // toast({ title: 'Signup Error', description: errorMessage, variant: 'destructive' }); // Optional: Show toast as well
        setCurrentStep('signup'); // Stay on signup step on error
      } finally {
        setIsProcessing(false); // End processing regardless of outcome
        console.log('Signup transition finished.');
      }
    });
  }, [toast]); // Added toast as dependency

  // Callback when MFA is successfully verified and enabled
  const handleMfaVerified = useCallback(() => {
    console.log('MFA verified, moving to skills step.');
    setCurrentStep('skills');
    toast({
      title: 'MFA Enabled!',
      description: 'Now, please describe your skills.',
      variant: 'default',
    });
  }, [toast]); // Added toast as dependency

  const handleSkillsSubmit = useCallback(async () => {
    console.log('handleSkillsSubmit called.');
    if (!freelancerId) {
      const errorMsg = "Missing freelancer ID. Cannot process skills. Please sign up again.";
      console.error(errorMsg);
      setSignupError(errorMsg);
      toast({ title: "Error", description: "Could not start skill assessment.", variant: "destructive" });
      setCurrentStep('signup');
      return;
    }
    const skillsText = form.getValues('skillsText');
    if (!skillsText || skillsText.trim().length < 10) {
      console.log('Skills text validation failed.');
      form.setError("skillsText", { type: "manual", message: "Please provide a meaningful description of your skills (min 10 characters)." });
      return;
    }
    setSignupError(null);
    setIsProcessing(true); // Start processing
    console.log('Starting skills processing transition...');

    startTransition(async () => {
      try {
        console.log(`Determining primary skill for text: "${skillsText.substring(0, 50)}..."`);
        const skillResult: DeterminePrimarySkillOutput = await determinePrimarySkill({ skillsDescription: skillsText });
        console.log('Skill determination result:', skillResult);

        if (!skillResult.primarySkill || !skillResult.extractedSkills || skillResult.extractedSkills.length === 0) {
          throw new Error("Could not identify skills from the description provided.");
        }

        setPrimarySkill(skillResult.primarySkill);
        setAllSkills(skillResult.extractedSkills);
        console.log(`Primary skill: ${skillResult.primarySkill}, All skills: ${skillResult.extractedSkills.join(', ')}`);

        // Update the freelancer's skills in Firestore
        console.log(`Updating skills for freelancer ${freelancerId} in Firestore...`);
        await updateFreelancerSkills(freelancerId, skillResult.extractedSkills);
        console.log('Freelancer skills updated successfully.');

        setCurrentStep('assessment');
        toast({
          title: 'Skills Identified!',
          description: `Preparing assessment for: ${skillResult.primarySkill}`,
          variant: 'default',
        });

      } catch (err: any) {
        console.error('Error determining/saving skills:', err);
        const errorMessage = err.message || 'Failed to process skills description. Please check the description and try again.';
        setSignupError(errorMessage);
        // toast({ title: 'Skill Processing Error', description: errorMessage, variant: 'destructive' }); // Optional toast
        setCurrentStep('skills'); // Allow user to retry entering skills
      } finally {
          setIsProcessing(false); // End processing
          console.log('Skills processing transition finished.');
      }
    });
  }, [freelancerId, form, toast]); // Added form and toast dependencies

  // Callback from AdaptiveSkillAssessment when complete
  const handleAssessmentComplete = useCallback(() => {
    console.log('Assessment complete, transitioning to complete step.');
    setCurrentStep('complete');
    form.reset(); // Clear form fields
    toast({
      title: 'Onboarding Complete!',
      description: 'Your skill assessment is finished and saved.',
      variant: 'success', // Use success variant
    });
    // Redirect to dashboard after a short delay to allow user to see the message
    console.log(`Redirecting to dashboard for freelancer ${freelancerId}...`);
    setTimeout(() => {
      router.push(`/freelancer/dashboard?id=${freelancerId}`);
    }, 3000); // 3-second delay
  }, [form, toast, freelancerId, router]); // Added dependencies

  // --- Conditional Rendering ---

   if (currentStep === 'mfa' && freelancerId && freelancerEmail && mfaSecret) {
     return <MfaSetup
              userId={freelancerId}
              userEmail={freelancerEmail}
              userType="freelancer"
              mfaSecret={mfaSecret}
              onVerified={handleMfaVerified}
              // Handle MFA setup errors displayed within MfaSetup
              onCancel={() => {
                console.log('MFA setup cancelled, returning to signup step.');
                setSignupError(null); // Clear errors when cancelling MFA
                setCurrentStep('signup');
              }}
            />;
   }

   if (currentStep === 'assessment' && freelancerId && primarySkill && allSkills.length > 0) {
     // AdaptiveSkillAssessment handles its own errors internally
     return <AdaptiveSkillAssessment
              freelancerId={freelancerId}
              primarySkill={primarySkill}
              allSkills={allSkills}
              onComplete={handleAssessmentComplete}
            />;
   }

   if (currentStep === 'complete') {
        return (
           <Card className="w-full max-w-lg shadow-lg">
                <CardHeader className="text-center">
                    <CardTitle>Onboarding Complete!</CardTitle>
                    <CardDescription>Welcome to Hireverse AI!</CardDescription>
                </CardHeader>
               <CardContent className="text-center">
                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">
                        Your profile is set up and your skills have been assessed. Redirecting to your dashboard...
                    </p>
                    <Loader2 className="h-6 w-6 mx-auto animate-spin text-primary" />
                    {/* Optional: Add manual link in case redirect fails */}
                    {/* <Button asChild variant="link" className="mt-2">
                         <a href={`/freelancer/dashboard?id=${freelancerId}`}>Go to Dashboard Now</a>
                    </Button> */}
               </CardContent>
           </Card>
        );
   }

  // Render Signup Form or Skills Input Form within a Card
  return (
     <Card className="w-full max-w-lg shadow-lg">
       <CardHeader>
         <CardTitle>Freelancer Signup</CardTitle>
         <CardDescription>
            {currentStep === 'signup' ? 'Join Hireverse AI and showcase your skills.' : 'Describe your skills'}
         </CardDescription>
       </CardHeader>

       {currentStep === 'signup' && (
         <Form {...form}>
           <form onSubmit={form.handleSubmit(handleSignupSubmit)}>
             <CardContent className="space-y-4">
               {/* Display Signup Error Alert within CardContent */}
               {signupError && currentStep === 'signup' && (
                    <Alert variant="destructive" className="w-full">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Signup Error</AlertTitle>
                        <AlertDescription>{signupError}</AlertDescription>
                    </Alert>
                )}
               <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="e.g., Jane Doe" {...field} disabled={isProcessing} /></FormControl><FormMessage /></FormItem>)} />
               <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" placeholder="e.g., jane.doe@example.com" {...field} disabled={isProcessing} /></FormControl><FormMessage /></FormItem>)} />
               <FormField control={form.control} name="password" render={({ field }) => ( <FormItem><FormLabel>Password</FormLabel><FormControl><div className="relative"><Input type={showPassword ? "text" : "password"} placeholder="Enter your password" {...field} disabled={isProcessing} /><Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowPassword((prev) => !prev)} tabIndex={-1} disabled={isProcessing}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}<span className="sr-only">{showPassword ? "Hide password" : "Show password"}</span></Button></div></FormControl><p className="text-xs text-muted-foreground pt-1">Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char.</p><FormMessage /></FormItem>)} />
               <FormField control={form.control} name="confirmPassword" render={({ field }) => ( <FormItem><FormLabel>Confirm Password</FormLabel><FormControl><div className="relative"><Input type={showConfirmPassword ? "text" : "password"} placeholder="Confirm your password" {...field} disabled={isProcessing}/><Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowConfirmPassword((prev) => !prev)} tabIndex={-1} disabled={isProcessing}>{showConfirmPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}<span className="sr-only">{showConfirmPassword ? "Hide password" : "Show password"}</span></Button></div></FormControl><FormMessage /></FormItem>)} />
             </CardContent>
             <CardFooter className="flex flex-col items-center gap-4">
               <Button type="submit" disabled={isPending || isProcessing || !form.formState.isValid} className="w-full">
                 {isPending || isProcessing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> : <><UserPlus className="mr-2 h-4 w-4" />Create Account & Set Up MFA</>}
               </Button>
             </CardFooter>
           </form>
         </Form>
       )}

       {currentStep === 'skills' && (
           <Form {...form}>
               {/* Use a basic form tag or div as we handle submit via button onClick */}
               <div>
                   <CardContent className="space-y-4">
                       <Separator />
                       <h3 className="text-lg font-semibold">Describe Your Skills</h3>
                       <p className="text-sm text-muted-foreground">
                           Briefly describe your main skills and experience (e.g., "Expert in React, Node.js, and database design", "Professional copywriter specializing in marketing materials", "Skilled graphic designer with experience in branding and UI/UX"). Our AI will identify your primary skill for the assessment.
                       </p>
                       {/* Display Skill Processing Error Alert */}
                       {signupError && currentStep === 'skills' && (
                             <Alert variant="destructive" className="w-full">
                                 <AlertCircle className="h-4 w-4" />
                                 <AlertTitle>Skill Processing Error</AlertTitle>
                                 <AlertDescription>{signupError}</AlertDescription>
                             </Alert>
                         )}
                       <FormField
                           control={form.control}
                           name="skillsText"
                           render={({ field }) => (
                               <FormItem>
                                   <FormLabel>Skills & Experience</FormLabel>
                                   <FormControl>
                                       <Textarea
                                           placeholder="Describe your skills here..."
                                           className="min-h-[100px]"
                                           {...field}
                                           disabled={isProcessing} // Disable while processing
                                       />
                                   </FormControl>
                                   <FormMessage />
                               </FormItem>
                           )}
                       />
                   </CardContent>
                   <CardFooter className="flex justify-center">
                       <Button type="button" onClick={handleSkillsSubmit} disabled={isPending || isProcessing || !form.watch('skillsText') || form.watch('skillsText')!.length < 10} >
                           {isPending || isProcessing ? (
                               <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing Skills... </>
                           ) : (
                               <> <BrainCircuit className="mr-2 h-4 w-4" /> Identify Primary Skill & Start Assessment </>
                           )}
                       </Button>
                   </CardFooter>
               </div>
           </Form>
       )}
     </Card>
   );
}
