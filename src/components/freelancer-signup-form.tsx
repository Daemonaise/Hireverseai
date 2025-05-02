
'use client';

import { useState, useTransition, useCallback } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Loader2, CheckCircle, AlertCircle, Send, Eye, EyeOff, QrCode, BrainCircuit, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
// Import real authentication and Firestore functions
import { createAuthUser, addFreelancer, storeUserMfaSecret, generateMfaSecret, updateFreelancerSkills, enableUserMfa } from '@/services/firestore';
import { determinePrimarySkill, type DeterminePrimarySkillOutput } from '@/ai/flows/determine-primary-skill';
import { AdaptiveSkillAssessment } from '@/components/adaptive-skill-assessment';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { MfaSetup } from '@/components/mfa-setup';

// Schema for the initial signup step
const signupFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters.' })
   .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter.' })
   .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter.' })
   .regex(/[0-9]/, { message: 'Password must contain at least one number.' })
   .regex(/[^a-zA-Z0-9]/, { message: 'Password must contain at least one special character.' }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Schema for the skills step (includes skillsText)
const skillsFormSchema = z.object({
  skillsText: z.string().min(10, {message: 'Please describe your skills in at least 10 characters.'}),
});

type SignupFormSchema = z.infer<typeof signupFormSchema>;
type SkillsFormSchema = z.infer<typeof skillsFormSchema>;


export function FreelancerSignupForm() {
  const [isPending, startTransition] = useTransition();
  const [isProcessing, setIsProcessing] = useState(false); // Combined loading state
  const [currentStep, setCurrentStep] = useState<'signup' | 'mfa' | 'skills' | 'assessment' | 'complete'>('signup');
  const [signupError, setSignupError] = useState<string | null>(null);
  const [freelancerId, setFreelancerId] = useState<string | null>(null); // Use the actual ID from auth/firestore
  const [freelancerEmail, setFreelancerEmail] = useState<string | null>(null);
  const [primarySkill, setPrimarySkill] = useState<string | null>(null);
  const [allSkills, setAllSkills] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [skillsTextValue, setSkillsTextValue] = useState(''); // Local state for skills textarea

  const { toast } = useToast();
  const router = useRouter();

  // Form hook for the initial signup fields
  const signupForm = useForm<SignupFormSchema>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
     mode: "onChange", // Validate on change
  });

  // Form hook specifically for the skills step
   const skillsForm = useForm<SkillsFormSchema>({
      resolver: zodResolver(skillsFormSchema),
      defaultValues: {
        skillsText: '',
      },
      mode: 'onChange',
   });

  // Destructure formState for easier access and logging (specifically for the signup step)
  const { isValid: isSignupFormValid, errors: signupFormErrors, isDirty: isSignupFormDirty } = signupForm.formState;
  const { isValid: isSkillsFormValid, errors: skillsFormErrors } = skillsForm.formState;

  // Log form validity state and errors for debugging
   // console.log("FreelancerSignupForm State:", {
   //   currentStep,
   //   isPending,
   //   isProcessing,
   //   isSignupFormValid,
   //   signupFormErrors,
   //   isSkillsFormValid,
   //   skillsFormErrors,
   // });


  const handleSignupSubmit = useCallback(async (values: SignupFormSchema) => {
    console.log('handleSignupSubmit (freelancer) called with values:', values.email);
    setSignupError(null);
    setFreelancerId(null);
    setFreelancerEmail(null);
    setMfaSecret(null);
    setIsProcessing(true); // Start processing indicator
    console.log('Starting freelancer signup transition...');

    startTransition(async () => {
      try {
        // 1. Create Authentication User (using the actual service)
        const authResult = await createAuthUser(values.email, values.password);
        if (!authResult || !authResult.userId) {
          // createAuthUser should throw specific errors (e.g., email exists)
          throw new Error(authResult?.error || "Failed to create authentication account.");
        }
        const newUserId = authResult.userId; // This is the actual ID from the auth system
        console.log("Auth user created successfully, User ID:", newUserId);

        // 2. Add freelancer document to Firestore using the Auth User ID
        console.log(`Adding freelancer ${newUserId} to Firestore...`);
        const newFreelancerId = await addFreelancer({
          id: newUserId, // Use the ID from the auth system
          name: values.name,
          email: values.email,
        });
        console.log(`Firestore document created/verified with ID: ${newFreelancerId}`); // ID should match newUserId

        // 3. Generate and store MFA secret in Firestore
        console.log("Generating MFA secret...");
        const secret = generateMfaSecret(); // Synchronous
        console.log(`MFA Secret generated. Storing for freelancer ${newFreelancerId}...`);
        await storeUserMfaSecret(newFreelancerId, secret, 'freelancer');
        console.log("MFA secret stored successfully.");

        // Set state for the next step (MFA Setup)
        setFreelancerId(newFreelancerId); // Store the confirmed freelancer ID
        setFreelancerEmail(values.email);
        setMfaSecret(secret);

        // Transition to MFA setup step
        console.log("Signup successful, transitioning to MFA step.");
        setCurrentStep('mfa');
        toast({
          title: 'Account Created',
          description: 'Please set up Multi-Factor Authentication.',
        });

      } catch (err: any) {
        console.error('Error during freelancer signup transition:', err);
        let errorMessage = err.message || 'An unexpected error occurred during signup.';
        // Check for specific Firestore offline error code or message
        if (err.code === 'unavailable' || errorMessage.includes('client is offline')) {
            errorMessage = 'Network connection issue. Please check your internet and try again.';
        } else if (errorMessage.includes('already exists')) {
            errorMessage = 'An account with this email already exists.';
        }
        setSignupError(errorMessage);
        console.log(`Signup error set: ${errorMessage}`);
        setCurrentStep('signup'); // Stay on signup step on error
      } finally {
        setIsProcessing(false); // End processing indicator
        console.log('Signup transition finished.');
      }
    });
  }, [toast]);

  // Callback when MFA is successfully verified and enabled (by MfaSetup)
  const handleMfaVerified = useCallback(async () => {
    console.log('MFA verified, moving to skills step.');
    if (!freelancerId) {
        setSignupError("Critical error: Freelancer ID missing after MFA verification.");
        setCurrentStep('signup'); // Revert to signup on critical error
        return;
    }
    // Mark MFA as enabled in Firestore
    try {
       await enableUserMfa(freelancerId, 'freelancer');
       console.log(`MFA successfully enabled for freelancer ${freelancerId} in Firestore.`);
       setCurrentStep('skills');
       toast({
         title: 'MFA Enabled!',
         description: 'Now, please describe your skills.',
       });
    } catch (enableError: any) {
        console.error(`Failed to mark MFA as enabled for freelancer ${freelancerId}:`, enableError);
        setSignupError(`MFA verified, but failed to save status: ${enableError.message}. Please contact support.`);
        // Stay on MFA step if enabling fails, allowing user/system to potentially retry or diagnose
        setCurrentStep('mfa');
        toast({ title: 'MFA Error', description: 'Could not save MFA status.', variant: 'destructive'});
    }
  }, [freelancerId, toast]);

  const handleSkillsSubmit = useCallback(async (values: SkillsFormSchema) => {
    console.log('handleSkillsSubmit called.');
    if (!freelancerId) {
      const errorMsg = "Missing freelancer ID. Cannot process skills.";
      console.error(errorMsg);
      setSignupError(errorMsg);
      toast({ title: "Error", description: errorMsg, variant: "destructive" });
      setCurrentStep('signup'); // Revert if ID is lost
      return;
    }
    const skillsText = values.skillsText; // Get from validated form values
    // The check for length < 10 is now handled by the Zod schema

    setSignupError(null);
    setIsProcessing(true); // Start processing indicator
    console.log('Starting skills processing transition...');

    startTransition(async () => {
      try {
        console.log(`Determining primary skill for text: "${skillsText.substring(0, 50)}..."`);
        const skillResult: DeterminePrimarySkillOutput = await determinePrimarySkill({ skillsDescription: skillsText });
        console.log('Skill determination result:', skillResult);

        if (!skillResult.primarySkill || !skillResult.extractedSkills || skillResult.extractedSkills.length === 0) {
          throw new Error("AI could not identify skills from the description. Please try rephrasing.");
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
        });

      } catch (err: any) {
        console.error('Error determining/saving skills:', err);
        const errorMessage = err.message || 'Failed to process skills description.';
        setSignupError(errorMessage);
        setCurrentStep('skills'); // Allow retry
      } finally {
          setIsProcessing(false); // End processing indicator
          console.log('Skills processing transition finished.');
      }
    });
  }, [freelancerId, toast]); // Removed skillsForm as it's passed directly to onSubmit

  // Callback from AdaptiveSkillAssessment when complete
  const handleAssessmentComplete = useCallback(() => {
    console.log('Assessment complete, transitioning to complete step.');
    setCurrentStep('complete');
    signupForm.reset(); // Clear signup form
    skillsForm.reset(); // Clear skills form
    toast({
      title: 'Onboarding Complete!',
      description: 'Your skill assessment is finished and saved.',
      variant: 'success',
    });
    // Redirect to dashboard after a delay
    console.log(`Redirecting to dashboard for freelancer ${freelancerId}...`);
    setTimeout(() => {
      if (freelancerId) {
          router.push(`/freelancer/dashboard?id=${freelancerId}`);
      } else {
          console.error("Freelancer ID missing, cannot redirect to dashboard.");
          // Optionally redirect to login or show error
          router.push('/freelancer/login');
      }
    }, 3000);
  }, [signupForm, skillsForm, toast, freelancerId, router]); // Added forms to dependencies

  // --- Conditional Rendering ---

   if (currentStep === 'mfa' && freelancerId && freelancerEmail && mfaSecret) {
     return <MfaSetup
              userId={freelancerId}
              userEmail={freelancerEmail}
              userType="freelancer"
              mfaSecret={mfaSecret}
              onVerified={handleMfaVerified}
              onCancel={() => {
                console.log('Client MFA setup cancelled, returning to signup.');
                setSignupError(null); // Clear errors when cancelling MFA
                setCurrentStep('signup');
              }}
            />;
   }

   if (currentStep === 'assessment' && freelancerId && primarySkill && allSkills.length > 0) {
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
                        Your profile is set up and skills assessed. Redirecting to your dashboard...
                    </p>
                    <Loader2 className="h-6 w-6 mx-auto animate-spin text-primary" />
               </CardContent>
           </Card>
        );
   }

  // Render Signup Form or Skills Input Form
  return (
     <Card className="w-full max-w-lg shadow-lg">
       <CardHeader>
         <CardTitle>Freelancer Signup</CardTitle>
         <CardDescription>
            {currentStep === 'signup' ? 'Join Hireverse AI and showcase your skills.' : 'Describe your skills'}
         </CardDescription>
       </CardHeader>

       {currentStep === 'signup' && (
         <Form {...signupForm}>
           <form onSubmit={signupForm.handleSubmit(handleSignupSubmit)}>
             <CardContent className="space-y-4">
               {/* Display Signup Error Alert */}
               {signupError && currentStep === 'signup' && (
                    <Alert variant="destructive" className="w-full">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Signup Error</AlertTitle>
                        <AlertDescription>{signupError}</AlertDescription>
                    </Alert>
                )}
               <FormField control={signupForm.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="e.g., Jane Doe" {...field} disabled={isProcessing || isPending} /></FormControl><FormMessage /></FormItem>)} />
               <FormField control={signupForm.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" placeholder="e.g., jane.doe@example.com" {...field} disabled={isProcessing || isPending} /></FormControl><FormMessage /></FormItem>)} />
               <FormField control={signupForm.control} name="password" render={({ field }) => ( <FormItem><FormLabel>Password</FormLabel><FormControl><div className="relative"><Input type={showPassword ? "text" : "password"} placeholder="Enter your password" {...field} disabled={isProcessing || isPending} /><Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowPassword((prev) => !prev)} tabIndex={-1} disabled={isProcessing || isPending}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}<span className="sr-only">{showPassword ? "Hide password" : "Show password"}</span></Button></div></FormControl><p className="text-xs text-muted-foreground pt-1">Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char.</p><FormMessage /></FormItem>)} />
               <FormField control={signupForm.control} name="confirmPassword" render={({ field }) => ( <FormItem><FormLabel>Confirm Password</FormLabel><FormControl><div className="relative"><Input type={showConfirmPassword ? "text" : "password"} placeholder="Confirm your password" {...field} disabled={isProcessing || isPending}/><Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowConfirmPassword((prev) => !prev)} tabIndex={-1} disabled={isProcessing || isPending}>{showConfirmPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}<span className="sr-only">{showConfirmPassword ? "Hide password" : "Show password"}</span></Button></div></FormControl><FormMessage /></FormItem>)} />
             </CardContent>
             <CardFooter className="flex flex-col items-center gap-4">
               <Button
                 type="submit"
                 disabled={isPending || isProcessing || !isSignupFormValid} // Use isSignupFormValid here
                 className="w-full"
                 aria-disabled={isPending || isProcessing || !isSignupFormValid}
                >
                 {isPending || isProcessing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> : <><UserPlus className="mr-2 h-4 w-4" />Create Account & Set Up MFA</>}
               </Button>
                {/* Show validation message only if form has been interacted with */}
                {!isSignupFormValid && currentStep === 'signup' && !isProcessing && isSignupFormDirty && (
                    <p className="text-xs text-destructive text-center">Please complete all fields correctly.</p>
                )}
             </CardFooter>
           </form>
         </Form>
       )}

       {currentStep === 'skills' && (
           <Form {...skillsForm}>
               {/* Use the specific form instance for skills */}
               <form onSubmit={skillsForm.handleSubmit(handleSkillsSubmit)}>
                   <CardContent className="space-y-4">
                       <Separator />
                       <h3 className="text-lg font-semibold">Describe Your Skills</h3>
                       <p className="text-sm text-muted-foreground">
                           Briefly describe your main skills and experience (e.g., "Expert in React, Node.js, and database design", "Professional copywriter specializing in marketing materials"). Our AI will identify your primary skill for the assessment.
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
                           control={skillsForm.control}
                           name="skillsText"
                           render={({ field }) => (
                               <FormItem>
                                   <FormLabel>Skills & Experience</FormLabel>
                                   <FormControl>
                                       <Textarea
                                           placeholder="Describe your skills here..."
                                           className="min-h-[100px]"
                                           {...field}
                                           disabled={isProcessing || isPending} // Disable while processing
                                       />
                                   </FormControl>
                                   <FormMessage />
                               </FormItem>
                           )}
                       />
                   </CardContent>
                   <CardFooter className="flex justify-center">
                        <Button
                             type="submit"
                             disabled={isPending || isProcessing || !isSkillsFormValid} // Use isSkillsFormValid here
                        >
                           {isPending || isProcessing ? (
                               <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing Skills... </>
                           ) : (
                               <> <BrainCircuit className="mr-2 h-4 w-4" /> Identify Primary Skill & Start Assessment </>
                           )}
                       </Button>
                   </CardFooter>
               </form>
           </Form>
       )}
     </Card>
   );
}
