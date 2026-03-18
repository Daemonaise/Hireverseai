
'use client';

import { useState, useTransition, useCallback } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Loader2, AlertCircle, BrainCircuit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { addFreelancer, updateFreelancerSkills } from '@/services/firestore';
import { determinePrimarySkill, type DeterminePrimarySkillOutput } from '@/ai/flows/determine-primary-skill';
import { AssessmentShell } from '@/components/assessment/assessment-shell';
import { storeAssessmentResult } from '@/services/firestore';
import type { AssessmentResult } from '@/types/assessment';
import { Textarea } from '@/components/ui/textarea';

const formSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  resumeText: z.string().min(50, { message: 'Please paste your full resume text (minimum 50 characters).' }),
});

type FormSchema = z.infer<typeof formSchema>;

export function FreelancerSignupForm() {
  const [isProcessing, startTransition] = useTransition();
  const [currentStep, setCurrentStep] = useState<'signup' | 'assessment'>('signup');
  const [error, setError] = useState<string | null>(null);
  const [freelancerId, setFreelancerId] = useState<string | null>(null);
  const [primarySkill, setPrimarySkill] = useState<string | null>(null);
  const [allSkills, setAllSkills] = useState<string[]>([]);

  const { toast } = useToast();

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      resumeText: '',
    },
    mode: 'onChange',
  });

  const handleFormSubmit = useCallback(async (values: FormSchema) => {
    setError(null);
    startTransition(async () => {
      try {
        // For testing, we'll use a simulated ID. In a real app, this would come from auth.
        const simulatedId = `freelancer-${values.email.split('@')[0]}-${Date.now() % 10000}`;

        // 1. Add basic freelancer document to Firestore.
        // The `addFreelancer` function is designed to handle this simplified object.
        await addFreelancer({
          id: simulatedId,
          name: values.name,
          email: values.email,
        });

        setFreelancerId(simulatedId);

        // 2. Use AI to determine skills from the pasted resume text.
        toast({ title: 'Analyzing Resume...', description: 'Our AI is extracting your skills.' });
        const skillResult: DeterminePrimarySkillOutput = await determinePrimarySkill({ skillsDescription: values.resumeText });

        if (!skillResult.primarySkill || skillResult.extractedSkills.length === 0) {
          throw new Error('The AI could not determine your skills from the provided resume. Please try pasting a more detailed resume.');
        }

        setPrimarySkill(skillResult.primarySkill);
        setAllSkills(skillResult.extractedSkills);

        // 3. Update the freelancer document with the extracted skills.
        await updateFreelancerSkills(simulatedId, skillResult.extractedSkills);

        // 4. Transition to the assessment step.
        toast({
          title: 'Skills Identified!',
          description: `Preparing your assessment for: ${skillResult.primarySkill}`,
        });
        setCurrentStep('assessment');
      } catch (err: any) {
        console.error('Error during signup process:', err);
        setError(err.message || 'An unexpected error occurred. Please try again.');
      }
    });
  }, [toast]);

  const handleAssessmentComplete = useCallback(() => {
    toast({
      title: 'Onboarding Complete!',
      description: 'Your profile is ready. You can now close this window.',
      variant: 'default',
      duration: 10000,
    });
    // In a real app, you would redirect the user to their dashboard.
    // For this test, we can just disable the form.
    setCurrentStep('signup');
    form.reset();
    alert("Assessment complete! In a real application, you would be redirected to your dashboard.");
  }, [toast, form]);

  if (currentStep === 'assessment' && freelancerId && primarySkill && allSkills.length > 0) {
    return (
      <AssessmentShell
        freelancerId={freelancerId}
        primarySkill={primarySkill}
        allSkills={allSkills}
        onComplete={async (result: AssessmentResult) => {
          try {
            await storeAssessmentResult({ ...result, freelancerId });
          } catch {
            // Storage failure shouldn't block completion
          }
          handleAssessmentComplete();
        }}
      />
    );
  }

  return (
    <Card className="w-full max-w-2xl shadow-lg">
      <CardHeader>
        <CardTitle>Freelancer Onboarding</CardTitle>
        <CardDescription>
          Enter your details and paste your resume to start the skill assessment process.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="e.g., Jane Doe" {...field} disabled={isProcessing} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" placeholder="e.g., jane.doe@example.com" {...field} disabled={isProcessing} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <FormField
              control={form.control}
              name="resumeText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Paste Your Resume</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Paste the full text of your resume here..."
                      className="min-h-[250px] resize-y"
                      {...field}
                      disabled={isProcessing}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              disabled={isProcessing || !form.formState.isValid}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <BrainCircuit className="mr-2 h-4 w-4" />
                  Analyze Resume & Start Assessment
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
