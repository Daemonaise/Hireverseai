
'use client';

import { useEffect, useState, useTransition, useCallback, useMemo } from 'react';
import { getFreelancerById, updateFreelancerStatus, getAssignedProjects, unassignProjectFromFreelancer, updateProjectStatus, getFreelancerAssessmentStatus } from '@/services/firestore'; // Assuming updateProjectStatus exists
import type { Freelancer, FreelancerStatus } from '@/types/freelancer';
import type { Project } from '@/types/project';
import { AdaptiveSkillAssessment } from '@/components/adaptive-skill-assessment'; // Import the AdaptiveSkillAssessment component
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, Briefcase, Power, PowerOff, Upload, ListChecks, CheckCircle, X } from 'lucide-react'; // Added AlertCircle
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';

import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge'; // Use the Badge component
// TODO: Import AI QA function when available
// import { performQualityCheck } from '@/ai/flows/quality-assurance';

interface FreelancerDashboardProps {
  freelancerId: string; // ID of the logged-in freelancer
}

// Define placeholder ID constant
const PLACEHOLDER_ID = "PLACEHOLDER_ID";

export function FreelancerDashboard({ freelancerId }: FreelancerDashboardProps) {
  const [freelancer, setFreelancer] = useState<Freelancer | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStatusPending, startStatusTransition] = useTransition();
  const [projectLoadError, setProjectLoadError] = useState<string | null>(null);
  const [submissionData, setSubmissionData] = useState<{ [projectId: string]: { work: string; qaFeedback?: string; isSubmitting: boolean; isQAPending: boolean } }>({});
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [assessmentComplete, setAssessmentComplete] = useState(false);

  const { toast } = useToast();

  // Fetch initial data
  const fetchData = useCallback(async () => {
    if (!freelancerId || freelancerId === PLACEHOLDER_ID) {
      setError("Freelancer ID is missing. Cannot load dashboard.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    setError(null);
    setProjectLoadError(null); // Clear project specific errors on refetch


    try {
      // Fetch freelancer and projects concurrently
      const [freelancerData, projectData] = await Promise.all([
        getFreelancerById(freelancerId).catch(err => {
            console.error("Error fetching freelancer:", err);
            setError("Failed to load freelancer profile.");
            return null; // Allow component to render partially if projects load
        }),
        getAssignedProjects(freelancerId).catch(err => {
            console.error("Error fetching projects:", err);
            setProjectLoadError("Failed to load assigned projects.");
            return []; // Return empty array on error
        })
      ]);


      // Fetch assessment status only if assessment is not complete
      if(!assessmentComplete) {
          const assessmentStatus = await getFreelancerAssessmentStatus(freelancerId);
          if (assessmentStatus === "not-started" || assessmentStatus === "in-progress") {
            setShowAssessmentModal(true);
          } else {
            setAssessmentComplete(true);
          }
      }

      if (freelancerData) {
        setFreelancer(freelancerData);
        // Simulate login status update only if explicitly needed for demo
        if (!freelancerData.isLoggedIn && freelancerData.status === 'offline') {
           try {
             await updateFreelancerStatus(freelancerId, 'available', true);
             setFreelancer(prev => prev ? { ...prev, isLoggedIn: true, status: 'available' } : null);
             console.log("Simulated login status update for demo.");
           } catch (statusErr) {
             console.error("Failed to simulate login status update:", statusErr);
             // Non-critical error, dashboard can still load
           }
        }
      } else if (!error) { // Only set error if not already set by fetchFreelancerById catch
          setError(`Freelancer profile not found for ID: ${freelancerId}`);
      }

      setProjects(projectData);
      // Initialize submission state for each project
      setSubmissionData(prev => {
        const newState = { ...prev };
        projectData.forEach(p => {
          if (!newState[p.id as string]) {
            newState[p.id as string] = { work: '', qaFeedback: undefined, isSubmitting: false, isQAPending: false };
          }
        });
        return newState;
      });

    } catch (err) { // Catch any unexpected errors
      console.error("Unexpected error fetching dashboard data:", err);
      setError("An unexpected error occurred while loading the dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, [freelancerId, error, assessmentComplete]); // Added error to dependencies to avoid infinite loops if error occurs


  useEffect(() => {
    // Fetch data if assessment is complete or if freelancerId is valid and not placeholder
    if (assessmentComplete || (freelancerId && freelancerId !== PLACEHOLDER_ID)) {
      fetchData();
    }
    // Dependency array includes assessmentComplete and freelancerId to trigger refetch when they change
  }, [assessmentComplete, freelancerId, fetchData]); // Added fetchData to dependency array


  const handleStatusChange = useCallback((newStatus: FreelancerStatus) => {
    if (!freelancer?.id) return;
    const currentFreelancerId = freelancer.id; // Capture ID in case state changes mid-flight

    startStatusTransition(async () => {
      try {
        await updateFreelancerStatus(currentFreelancerId, newStatus);
        setFreelancer(prev => prev?.id === currentFreelancerId ? { ...prev, status: newStatus } : prev);
        toast({ title: "Status Updated", description: `Your status is now ${newStatus}.` });
      } catch (err) {
        toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
        console.error("Status update error:", err);
      }
    });
  }, [freelancer, toast]);

  const handleLogout = useCallback(() => {
    if (!freelancer?.id) return;
    const currentFreelancerId = freelancer.id;

    startStatusTransition(async () => {
      try {
        await updateFreelancerStatus(currentFreelancerId, 'offline', false);
        setFreelancer(prev => prev?.id === currentFreelancerId ? { ...prev, status: 'offline', isLoggedIn: false } : prev);
        toast({ title: "Logged Out", description: "You have been logged out." });
        // TODO: Implement proper redirection using Next Router
        // router.push('/freelancer/login');
        console.log("Logout successful, redirect to login page.");
      } catch (err) {
        toast({ title: "Error", description: "Failed to logout.", variant: "destructive" });
        console.error("Logout error:", err);
      }
    });
  }, [freelancer, toast]);

  const handleWorkChange = useCallback((projectId: string, value: string) => {
    setSubmissionData(prev => ({
      ...prev,
      [projectId]: {
        ...(prev[projectId] || { work: '', isSubmitting: false, isQAPending: false }), // Ensure entry exists
        work: value,
        qaFeedback: undefined, // Reset QA feedback on work change
      },
    }));
  }, []);

  const setProjectState = useCallback((projectId: string, state: Partial<typeof submissionData[string]>) => {
    setSubmissionData(prev => ({
      ...prev,
      [projectId]: {
        ...(prev[projectId] || { work: '', isSubmitting: false, isQAPending: false }),
        ...state,
      },
    }));
    }, []);

  const handleQualityCheck = useCallback(
    async (projectId: string) => {
      const projectData = submissionData[projectId];
      if (!projectData?.work) {
          toast({ title: "Input Missing", description: "Please enter your work before requesting QA.", variant: "destructive"});
          return;
      }

      setProjectState(projectId, { isQAPending: true });

      try {
          console.log(`Requesting QA check for project ${projectId}...`);
          // --- TODO: Implement Real AI Quality Check Flow call ---
          // Simulating AI check
          await new Promise(resolve => setTimeout(resolve, 1500));
          // const qaResult = await performQualityCheck({ projectId, submittedWork: projectData.work });
          const qaResult = { feedback: "AI QA Placeholder: Looks plausible. Consider adding more examples.", passed: Math.random() > 0.3 }; // Placeholder with random pass/fail
          // --- End Simulation ---

          setProjectState(projectId, { qaFeedback: qaResult.feedback });
          if (qaResult.passed) {
              toast({ title: "AI QA Complete", description: "Review the feedback below.", variant: "default"});
          } else {
              toast({ title: "AI QA Issues Found", description: "Please review feedback and revise your work.", variant: "destructive"});
          }
      } catch (err) {
          console.error("Error during AI QA:", err);
          toast({ title: "QA Error", description: "Could not perform quality check.", variant: "destructive" });
          setProjectState(projectId, { qaFeedback: "Error performing QA check." });
      } finally {
          setProjectState(projectId, { isQAPending: false });
      }
  }, [submissionData, toast, setProjectState]);



  const handleSubmitWork = useCallback(async (projectId: string) => {
    const projectData = submissionData[projectId];
    if (!projectData?.work) {
      toast({ title: "Input Missing", description: "Please enter your work before submitting.", variant: "destructive" });
      return;
    }
    // Optional: Add check for QA feedback if required before submission
    // if (!projectData.qaFeedback || projectData.qaFeedback.includes("Error")) { ... }

    setProjectState(projectId, { isSubmitting: true });

    try {
      console.log(`Submitting work for project ${projectId}...`);
      // --- TODO: Implement actual work submission logic ---
      // 1. Update the project/microtask status in Firestore
      // 2. Upload files if necessary
      // 3. Notify the system/client
      await updateProjectStatus(projectId, 'review'); // Example: Update status to 'review'

      // Simulating unassignment for demo purposes. In reality, it might stay assigned during review.
      await unassignProjectFromFreelancer(freelancerId, projectId);

      setProjects(prev => prev.filter(p => p.id !== projectId));
      // Clean up state for the submitted project
      setSubmissionData(prev => {
          const newState = { ...prev };
          delete newState[projectId];
          return newState;
      });
      toast({ title: "Work Submitted", description: `Work for project ${projectId} submitted for review.`, variant: "success" }); // Use success variant

    } catch (err) {
      console.error("Error submitting work:", err);
      toast({ title: "Submission Error", description: "Could not submit work.", variant: "destructive" });
    } finally {
      setProjectState(projectId, { isSubmitting: false });
    }
  }, [submissionData, toast, freelancerId, setProjectState]);


  // Derived state (memoized for performance if calculations were complex)
  const activeProjects = useMemo(() => projects.filter(p => p.status !== 'completed' && p.status !== 'cancelled'), [projects]);

  // --- Render Logic ---

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading Dashboard...</span>
      </div>
    );
  }

  if (error || !freelancerId) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error Loading Dashboard</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
         <Button variant="outline" size="sm" onClick={fetchData} className="mt-4">Retry</Button>
            </Alert>
    );
  }

  if (!freelancer && !error) {
    // This case indicates freelancer data couldn't be loaded, possibly due to ID issue handled in fetchData
    return (
        <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Could not load your freelancer profile. Please try logging out and back in.</AlertDescription>
            <Button variant="outline" size="sm" onClick={handleLogout} className="mt-4">Logout</Button>
        </Alert>
    );
  }

  const handleAssessmentComplete = useCallback(() => {
    setShowAssessmentModal(false); // Close the modal
    setAssessmentComplete(true); // Mark assessment as complete
    toast({
        title: "Assessment Complete",
        description: "Thank you for completing the assessment!",
        variant: "success",
    });
    // No need to call fetchData here, useEffect dependency change will trigger it
  }, [toast]);

  const handleCloseAssessmentModal = useCallback(() => {
    setShowAssessmentModal(false);
  }, []);



  // Wrap the entire return statement in a fragment
  return (
    <>
      {!assessmentComplete && showAssessmentModal && (
        <Dialog open={showAssessmentModal} onOpenChange={setShowAssessmentModal}>
          <DialogContent className="sm:max-w-[850px] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Adaptive Skill Assessment</DialogTitle>
              <DialogDescription>
                Please complete the assessment to unlock full access to your
                freelancer dashboard.
              </DialogDescription>
            </DialogHeader>
            <AdaptiveSkillAssessment
              onComplete={handleAssessmentComplete}
              // Removed onCancel prop as it's not used in AdaptiveSkillAssessment component
              freelancerId={freelancerId}
              // Ensure primarySkill and allSkills are passed if needed by the component
              // For now, passing dummy values or fetching actual skills
              primarySkill={freelancer?.skills?.[0] ?? 'General'}
              allSkills={freelancer?.skills ?? []}
            />
            {/* Removed DialogClose with onCancel handler as it's handled by onOpenChange */}
          </DialogContent>
        </Dialog>
      )}

      {/* Render dashboard content only if assessment is complete */}
      {assessmentComplete && (
        <div className="space-y-8">
            <Card className="shadow-md">
              <CardHeader className="flex flex-row items-center justify-between space-x-4">
                <div>
                  <CardTitle>Welcome, {freelancer.name}!</CardTitle>
                  <CardDescription>Manage your availability and projects.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={handleLogout} disabled={isStatusPending}>
                  {isStatusPending && freelancer.isLoggedIn === false ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PowerOff className="mr-2 h-4 w-4" />}
                  Logout
                </Button>
              </CardHeader>
              <CardContent className="flex items-center space-x-4">
                <Label htmlFor="status-select" className="shrink-0">Your Status:</Label>
                <Select
                  value={freelancer.status}
                  onValueChange={(value) => handleStatusChange(value as FreelancerStatus)}
                  disabled={isStatusPending || !freelancer.isLoggedIn}
                  name="status-select"
                >
                  <SelectTrigger className="w-full max-w-[180px]">
                      {isStatusPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null }
                      <SelectValue placeholder="Set Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">
                      <Power className="mr-2 h-4 w-4 inline-block text-green-500"/> Available
                    </SelectItem>
                    <SelectItem value="busy">
                      <Briefcase className="mr-2 h-4 w-4 inline-block text-orange-500"/> Busy
                    </SelectItem>
                    <SelectItem value="offline">
                      <PowerOff className="mr-2 h-4 w-4 inline-block text-red-500"/> Offline
                    </SelectItem>
                  </SelectContent>
                </Select>
                {!freelancer.isLoggedIn && <span className="text-sm text-muted-foreground">(Currently Logged Out)</span>}

              </CardContent>
            </Card>


          <Separator />

          <section>
            <h2 className="text-2xl font-semibold mb-4">Current Projects</h2>
            {projectLoadError && (
                <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error Loading Projects</AlertTitle>
                    <AlertDescription>{projectLoadError}</AlertDescription>
                    <Button variant="outline" size="sm" onClick={fetchData} className="mt-2">Retry</Button>
                </Alert>
            )}
            {!projectLoadError && activeProjects.length === 0 && (
              <Card className="shadow-sm border-dashed border-muted-foreground/50">
                <CardContent className="text-center py-12">
                    <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium text-muted-foreground">No active projects.</p>
                    <p className="text-sm text-muted-foreground mb-6">Set your status to "Available" to get matched!</p>
                    {/* Optional: Add a button to refresh projects */}
                    {/* <Button variant="outline" onClick={fetchData}>Refresh Projects</Button> */}
                </CardContent>
              </Card>
            )}
            <div className="space-y-6">
              {activeProjects.map((project) => {
                const projectState = submissionData[project.id as string] || { work: '', qaFeedback: undefined, isSubmitting: false, isQAPending: false };
                const isSubmitDisabled = projectState.isSubmitting || projectState.isQAPending || !projectState.work;
                const isQADisabled = projectState.isSubmitting || projectState.isQAPending || !projectState.work;

                return (
                  <Card key={project.id} className="shadow-sm">
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <CardTitle>{project.name}</CardTitle>
                            <Badge variant={project.status === 'assigned' ? 'default' : 'secondary'} className="capitalize whitespace-nowrap">
                                {project.status?.replace('_', ' ') ?? 'Unknown'}
                            </Badge>
                        </div>
                      <CardDescription>
                        Project ID: {project.id} | Status: <span className="capitalize font-medium">{project.status?.replace('_', ' ') ?? 'Unknown'}</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground line-clamp-3">{project.brief}</p>
                      <div>
                          <h4 className="font-semibold mb-1 text-sm">Required Skills:</h4>
                          <div className="flex flex-wrap gap-1">
                              {(project.requiredSkills ?? []).map(skill => (
                                  <Badge key={skill} variant="outline" className="text-xs">{skill}</Badge>
                              ))}
                          </div>
                      </div>
                      <Separator className="my-4"/>
                      <div className="space-y-2">
                          <Label htmlFor={`work-${project.id}`} className="text-base font-semibold">Submit Your Work</Label>
                          <Textarea
                              id={`work-${project.id}`}
                              placeholder="Paste or describe your completed work here..."
                              className="min-h-[150px]"
                              value={projectState.work}
                              onChange={(e) => handleWorkChange(project.id!, e.target.value)}
                              disabled={projectState.isSubmitting || projectState.isQAPending}
                              aria-describedby={`qa-feedback-${project.id}`}
                          />
                          {projectState.qaFeedback && (
                              <Alert
                                id={`qa-feedback-${project.id}`}
                                variant={projectState.qaFeedback.startsWith('Error') ? 'destructive' : 'default'}
                                className="mt-2 text-sm"
                              >
                                <ListChecks className="h-4 w-4" />
                                  <AlertTitle className="font-medium">AI QA Feedback</AlertTitle>
                                  <AlertDescription>{projectState.qaFeedback}</AlertDescription>
                              </Alert>
                          )}
                      </div>
                    </CardContent>
                    <CardFooter className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t">
                      <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleQualityCheck(project.id!)}
                          disabled={isQADisabled}
                          className="w-full sm:w-auto"
                      >
                          {projectState.isQAPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ListChecks className="mr-2 h-4 w-4"/>}
                          Run AI QA Check
                      </Button>
                      <Button
                          size="sm"
                          onClick={() => handleSubmitWork(project.id!)}
                          disabled={isSubmitDisabled}
                          className="w-full sm:w-auto"
                        >
                          {projectState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                          Submit Work
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </section>
        </div>
      )}
   </>
  );
}

