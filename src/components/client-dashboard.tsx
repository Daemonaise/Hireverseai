'use client';

import React, { useEffect, useState, useTransition } from 'react';
import Link from 'next/link'; // Added missing import
import { getProjectsByClientId, getFreelancerById, addChangeRequestToProject, updateChangeRequestInProject, updateProjectStatus } from '@/services/firestore';
import type { Project, ChangeRequest, ProjectStatus } from '@/types/project';
import type { Freelancer } from '@/types/freelancer';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, Briefcase, ListChecks, Send, Edit, Info, CircleX, FileUp, CheckCircle, Search } from 'lucide-react'; // Added Search icon
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { formatDistanceToNowStrict } from 'date-fns'; // For relative time
import { Timestamp } from 'firebase/firestore';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input'; // For search
import { Label } from '@/components/ui/label';
import { estimateProjectChangeImpact } from '@/ai/flows/request-project-change'; // Import the AI flow
import { Badge } from '@/components/ui/badge'; // Use the imported Badge component

interface ClientDashboardProps {
  clientId: string; // ID of the logged-in client
}

interface FreelancerCache {
    [id: string]: string; // Store freelancer ID -> name
}

export function ClientDashboard({ clientId }: ClientDashboardProps) {
    const [projects, setProjects] = useState<Project[]>([]);
    const [freelancerCache, setFreelancerCache] = useState<FreelancerCache>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [changeDescription, setChangeDescription] = useState('');
    const [changePriority, setChangePriority] = useState<'Normal' | 'High'>('Normal');
    const [changeFile, setChangeFile] = useState<File | null>(null); // For file upload (implementation TBD)
    const [isSubmittingChange, startChangeTransition] = useTransition();
    const [estimatedChange, setEstimatedChange] = useState<{ timeline: string; cost: number; analysis: string; requestId: string } | null>(null);
    const [isApproving, startApproveTransition] = useTransition();
    const [searchTerm, setSearchTerm] = useState(''); // For freelancer history search
    const [filteredProjects, setFilteredProjects] = useState<Project[]>([]); // Filtered projects

    const { toast } = useToast();

    // Fetch initial data
    useEffect(() => {
        async function fetchData() {
            if (!clientId) {
                setError("Client ID is missing. Cannot load dashboard.");
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            setError(null);
            try {
                const projectData = await getProjectsByClientId(clientId);
                setProjects(projectData);
                setFilteredProjects(projectData); // Initialize filtered list

                // Fetch freelancer names for assigned projects
                const freelancerIds = new Set(projectData.map(p => p.assignedFreelancerId).filter(Boolean) as string[]);
                const newCache: FreelancerCache = {};
                for (const id of freelancerIds) {
                     // Only fetch if not already in cache to avoid redundant calls
                     if (!freelancerCache[id]) {
                         const freelancer = await getFreelancerById(id);
                         newCache[id] = freelancer?.name ?? 'Unknown Freelancer';
                     } else {
                         newCache[id] = freelancerCache[id]; // Use existing cache value
                     }
                }
                 // Merge new cache data with existing, preventing overwrites if already present
                setFreelancerCache(prev => ({ ...prev, ...newCache }));

            } catch (err) {
                console.error("Error fetching dashboard data:", err);
                setError("Failed to load dashboard data. Please try again later.");
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
        // Re-fetch only when clientId changes. Cache updates are handled internally.
    }, [clientId]);

    // Filter projects based on search term (freelancer ID, name, or project name)
    useEffect(() => {
        if (!searchTerm) {
            setFilteredProjects(projects);
        } else {
            const lowerSearchTerm = searchTerm.toLowerCase();
            setFilteredProjects(
                projects.filter(p =>
                    p.id?.toLowerCase().includes(lowerSearchTerm) || // Search by project ID
                    p.name.toLowerCase().includes(lowerSearchTerm) || // Search by project name
                    p.assignedFreelancerId?.toLowerCase().includes(lowerSearchTerm) || // Search by freelancer ID
                    freelancerCache[p.assignedFreelancerId ?? '']?.toLowerCase().includes(lowerSearchTerm) // Search by freelancer name from cache
                )
            );
        }
    }, [searchTerm, projects, freelancerCache]);

    const handleOpenChangeSheet = (project: Project) => {
        setSelectedProject(project);
        setChangeDescription('');
        setChangePriority('Normal');
        setChangeFile(null);
        setEstimatedChange(null); // Clear previous estimates
        setIsSheetOpen(true);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            setChangeFile(event.target.files[0]);
            // TODO: Implement actual file upload logic here or on submit
        }
    };

    const handleSubmitChangeRequest = () => {
        if (!selectedProject || !changeDescription.trim()) {
            toast({ title: "Missing Information", description: "Please describe the change you need.", variant: "destructive" });
            return;
        }
         if (!selectedProject.id) {
             toast({ title: "Error", description: "Project ID is missing.", variant: "destructive" });
             return;
         }

        startChangeTransition(async () => {
            try {
                 // TODO: Handle file upload if 'changeFile' is set
                 const fileUrl: string | undefined = undefined;
                 if (changeFile) {
                     console.log("Simulating file upload for:", changeFile.name);
                     // Replace with actual upload logic (e.g., to Firebase Storage)
                     // fileUrl = await uploadFile(changeFile);
                 }

                 // 1. Add initial change request to Firestore (status: pending_estimate)
                 const changeRequestData = {
                     requestedBy: clientId,
                     description: changeDescription,
                     priority: changePriority,
                     fileUrl: fileUrl,
                 };
                 const newRequestId = await addChangeRequestToProject(selectedProject.id!, changeRequestData);
                 console.log("Change request added with ID:", newRequestId);


                 // 2. Call AI flow to get estimates
                 console.log("Requesting AI estimation for change...");
                 const estimateInput = {
                     projectId: selectedProject.id!,
                     currentBrief: selectedProject.brief,
                     currentSkills: selectedProject.requiredSkills,
                     currentTimeline: selectedProject.estimatedDeliveryDate
                         ? selectedProject.estimatedDeliveryDate.toDate().toISOString()
                         : 'Not set',
                     // Placeholder: Ideally fetch current cost if tracked, or use initial estimate
                     currentCost: 500, // Example: Use a placeholder or fetch actual cost
                     changeDescription: changeDescription,
                     priority: changePriority,
                 };
                 const estimateResult = await estimateProjectChangeImpact(estimateInput);

                 // 3. Update the change request in Firestore with estimates (status: pending_approval)
                  const updates = {
                     status: 'pending_approval' as ChangeRequest['status'],
                     // Handle potential date calculation issues more robustly
                     estimatedNewCompletionDate: estimateResult.estimatedNewTimeline ? Timestamp.fromDate(new Date(estimateResult.estimatedNewTimeline)) : undefined, // Assume ISO string or calculate based on 'additional days'
                     estimatedAdditionalCost: estimateResult.estimatedAdditionalCost,
                     analysis: estimateResult.impactAnalysis, // Store the analysis text
                  };
                  await updateChangeRequestInProject(selectedProject.id!, newRequestId, updates);


                 setEstimatedChange({
                     timeline: estimateResult.estimatedNewTimeline,
                     cost: estimateResult.estimatedAdditionalCost,
                     analysis: estimateResult.impactAnalysis,
                     requestId: newRequestId,
                 });
                 toast({ title: "Estimate Ready", description: "Review the estimated impact of your change." });

            } catch (err: any) {
                console.error("Error submitting change request:", err);
                toast({ title: "Error", description: `Failed to submit change request: ${err.message}`, variant: "destructive" });
                 // Optionally revert project status if needed
                 if (selectedProject?.id) {
                      // Consider adding logic to mark the change request as failed or remove it
                      await updateProjectStatus(selectedProject.id, 'assigned'); // Example: Revert to assigned status
                 }
            }
        });
    };

     const handleApproveChange = () => {
         if (!selectedProject?.id || !estimatedChange?.requestId) return;

         startApproveTransition(async () => {
             try {
                  // Update change request status to 'approved' and project status
                  await updateChangeRequestInProject(selectedProject.id!, estimatedChange.requestId, { status: 'approved' });
                  // Update project status separately if updateChangeRequestInProject doesn't handle it
                  await updateProjectStatus(selectedProject.id!, 'change_approved');

                  toast({ title: "Change Approved", description: "The project will be updated shortly.", variant: "default" });
                  setIsSheetOpen(false);
                  // Optimistic UI update or refetch
                   setProjects(prevProjects =>
                       prevProjects.map(p =>
                           p.id === selectedProject.id ? { ...p, status: 'change_approved' } : p
                       )
                   );
             } catch (err: any) {
                  console.error("Error approving change:", err);
                  toast({ title: "Approval Error", description: `Failed to approve change: ${err.message}`, variant: "destructive" });
             }
         });
     };

      const handleCancelRequest = () => {
         if (!selectedProject?.id || !estimatedChange?.requestId) return;

          startApproveTransition(async () => { // Reuse transition for loading state
             try {
                  // Update change request status to 'cancelled'
                  await updateChangeRequestInProject(selectedProject.id!, estimatedChange.requestId, { status: 'cancelled' });
                  // Revert project status if needed (check if other requests are pending)
                  // await updateProjectStatus(selectedProject.id!, 'assigned'); // Example: Revert to assigned

                  toast({ title: "Request Cancelled", description: "The change request has been cancelled.", variant: "default" });
                  setIsSheetOpen(false);
                  // Optimistic UI update or refetch
                   setProjects(prevProjects =>
                       prevProjects.map(p =>
                           p.id === selectedProject.id ? { ...p, status: 'assigned' } : p // Example: Revert status
                       )
                   );
             } catch (err: any) {
                  console.error("Error cancelling change request:", err);
                  toast({ title: "Cancellation Error", description: `Failed to cancel request: ${err.message}`, variant: "destructive" });
             }
         });
     };


    const formatDate = (timestamp?: Timestamp) => {
        if (!timestamp) return 'N/A';
        try {
             return timestamp.toDate().toLocaleDateString();
        } catch (e) {
             console.error("Error formatting date:", e);
             return 'Invalid Date';
        }
    };

    const formatRelativeTime = (timestamp?: Timestamp) => {
        if (!timestamp) return '';
         try {
             const date = timestamp.toDate();
             const now = new Date();
             if (date < now) return 'Past due';
             return formatDistanceToNowStrict(date, { addSuffix: true });
         } catch (e) {
             console.error("Error formatting relative time:", e);
             return '';
         }
    }

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Loading Dashboard...</span>
            </div>
        );
    }

    if (error) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        );
    }


    return (
        <div className="space-y-8">
            {/* Freelancer History Section */}
             <section>
                <h2 className="text-2xl font-semibold mb-4">Freelancer History</h2>
                 <div className="relative mb-4">
                     <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                     <Input
                        type="search"
                        placeholder="Search by Freelancer ID, Name, or Project..."
                        className="pl-8 w-full"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                     />
                 </div>
                <Card className="shadow-md max-h-72 overflow-y-auto">
                    <CardContent className="p-0">
                         {filteredProjects.filter(p => p.status === 'completed' || p.assignedFreelancerId).length === 0 ? (
                             <p className="p-6 text-center text-muted-foreground">No relevant project history found.</p>
                         ) : (
                            <ul className="divide-y divide-border">
                                {filteredProjects
                                    .filter(p => p.status === 'completed' || p.assignedFreelancerId) // Show completed or assigned
                                    .map((project) => (
                                    <li key={project.id} className="p-4">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="font-medium">{project.name}</p>
                                                {project.assignedFreelancerId && (
                                                     <p className="text-sm">
                                                        <span className="text-muted-foreground">Freelancer:</span> {freelancerCache[project.assignedFreelancerId] ?? 'Loading...'} (<span className="font-semibold">{project.assignedFreelancerId}</span>)
                                                     </p>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm text-muted-foreground">
                                                     {project.status === 'completed' ? 'Completed' : 'Last Update'}: {formatDate(project.updatedAt)}
                                                </p>
                                                {project.status !== 'completed' && <Badge variant="secondary" className="mt-1 capitalize">{project.status.replace('_', ' ')}</Badge>}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                         )}
                    </CardContent>
                </Card>
            </section>

            <Separator />

            {/* Current Projects Section */}
            <section>
                <h2 className="text-2xl font-semibold mb-4">Current Projects</h2>
                {projects.filter(p => p.status !== 'completed' && p.status !== 'cancelled').length === 0 ? (
                    <Card className="shadow-sm border-dashed border-muted-foreground/50">
                        <CardContent className="text-center py-12">
                            <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-lg font-medium text-muted-foreground">No active projects yet.</p>
                            <p className="text-sm text-muted-foreground mb-6">Submit your first project to start working with top freelancers.</p>
                            <Button asChild>
                                <Link href="/">Start a New Project</Link>
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {projects.filter(p => p.status !== 'completed' && p.status !== 'cancelled').map((project) => (
                            <Card key={project.id} className="shadow-md flex flex-col">
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                         <CardTitle>{project.name}</CardTitle>
                                         <Badge variant={project.status === 'change_requested' || project.status === 'change_approved' ? 'destructive' : 'secondary'} className="capitalize whitespace-nowrap">
                                             {project.status.replace('_', ' ')}
                                         </Badge>
                                    </div>
                                     <CardDescription>
                                        Freelancer: {project.assignedFreelancerId ? (freelancerCache[project.assignedFreelancerId] ?? 'Loading...') : 'Not Assigned'}
                                     </CardDescription>
                                </CardHeader>
                                <CardContent className="flex-grow space-y-3">
                                     <div className="space-y-1">
                                         <Label className="text-xs text-muted-foreground">Est. Delivery:</Label>
                                         <p className="text-sm font-medium">{formatDate(project.estimatedDeliveryDate)}</p>
                                         <p className="text-xs text-muted-foreground">{formatRelativeTime(project.estimatedDeliveryDate)}</p>
                                     </div>
                                      <div className="space-y-1">
                                          <Label className="text-xs text-muted-foreground">Progress:</Label>
                                          <Progress value={project.progress ?? 0} className="h-2" />
                                          <p className="text-xs text-muted-foreground text-right">{project.progress ?? 0}% complete</p>
                                      </div>
                                </CardContent>
                                <CardFooter>
                                    <Button variant="outline" size="sm" className="w-full" onClick={() => handleOpenChangeSheet(project)}>
                                        <Edit className="mr-2 h-4 w-4" />
                                        Request Change
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}
            </section>

             {/* Change Request Sheet */}
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetContent className="flex flex-col sm:max-w-lg">
                    <SheetHeader>
                        <SheetTitle>Request Change for: {selectedProject?.name}</SheetTitle>
                        <SheetDescription>
                             {estimatedChange ? "Review the estimated impact and approve or cancel." : "Describe the change needed. Our AI will estimate the impact on timeline and cost."}
                        </SheetDescription>
                    </SheetHeader>
                    <Separator className="my-4" />

                     {/* Form/Estimate Display Area */}
                     <div className="flex-grow overflow-y-auto pr-6 space-y-4">
                         {/* Change Request Form (shown initially) */}
                         {!estimatedChange && (
                             <div className="space-y-4">
                                 <div className="space-y-2">
                                     <Label htmlFor="change-description">Describe your requested change</Label>
                                     <Textarea
                                         id="change-description"
                                         placeholder="e.g., 'Please change the primary color to blue', 'Add a section about user testimonials'"
                                         className="min-h-[150px]"
                                         value={changeDescription}
                                         onChange={(e) => setChangeDescription(e.target.value)}
                                         disabled={isSubmittingChange}
                                     />
                                 </div>
                                 <div className="space-y-2">
                                     <Label htmlFor="change-priority">Priority</Label>
                                     <Select
                                         value={changePriority}
                                         onValueChange={(value) => setChangePriority(value as 'Normal' | 'High')}
                                         disabled={isSubmittingChange}
                                         name="change-priority"
                                     >
                                         <SelectTrigger>
                                             <SelectValue placeholder="Select priority" />
                                         </SelectTrigger>
                                         <SelectContent>
                                             <SelectItem value="Normal">Normal</SelectItem>
                                             <SelectItem value="High">High</SelectItem>
                                         </SelectContent>
                                     </Select>
                                 </div>
                                 <div className="space-y-2">
                                     <Label htmlFor="change-file">Attach File (Optional)</Label>
                                     <Input
                                         id="change-file"
                                         type="file"
                                         onChange={handleFileChange}
                                         disabled={isSubmittingChange}
                                         className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                                      />
                                      {changeFile && <p className="text-xs text-muted-foreground">Selected: {changeFile.name}</p>}
                                 </div>
                             </div>
                         )}

                         {/* Loading Indicator */}
                         {isSubmittingChange && !estimatedChange && (
                              <div className="flex justify-center items-center py-8">
                                   <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                   <span className="ml-2 text-muted-foreground">Calculating new estimate...</span>
                              </div>
                         )}

                         {/* Estimate Display (shown after calculation) */}
                         {estimatedChange && (
                              <Card className="bg-muted/50 border-border/50">
                                   <CardHeader>
                                        <CardTitle className="text-lg">Estimated Impact</CardTitle>
                                        <CardDescription>{estimatedChange.analysis}</CardDescription>
                                   </CardHeader>
                                   <CardContent className="space-y-2">
                                        <div className="flex justify-between">
                                             <span className="text-muted-foreground">New Timeline:</span>
                                             <span className="font-medium">{estimatedChange.timeline}</span>
                                        </div>
                                        <div className="flex justify-between">
                                             <span className="text-muted-foreground">Additional Cost:</span>
                                             <span className="font-medium">
                                                  {estimatedChange.cost > 0 ? `+$${estimatedChange.cost.toFixed(2)}` : 'No additional cost'}
                                             </span>
                                        </div>
                                   </CardContent>
                                   <CardFooter className="text-xs text-muted-foreground">
                                        Note: Changes require approval to proceed. Estimates based on AI analysis.
                                   </CardFooter>
                              </Card>
                         )}
                    </div>


                    {/* Footer Buttons */}
                    <SheetFooter className="mt-auto pt-4 border-t">
                         {!estimatedChange ? (
                              <Button className="w-full" onClick={handleSubmitChangeRequest} disabled={isSubmittingChange || !changeDescription.trim()}>
                                   {isSubmittingChange ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                   Submit Change Request
                              </Button>
                         ) : (
                              <div className="w-full grid grid-cols-2 gap-2">
                                  <Button variant="outline" onClick={handleCancelRequest} disabled={isApproving}>
                                        Cancel Request
                                   </Button>
                                   <Button className="bg-primary hover:bg-primary/90" onClick={handleApproveChange} disabled={isApproving}>
                                      {isApproving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                      Approve Changes
                                  </Button>

                              </div>
                         )}
                    </SheetFooter>
                </SheetContent>
            </Sheet>

        </div>
    );
}

// Assume Badge component exists and handles variants
// function Badge({ children, variant = 'secondary', className }: { children: React.ReactNode, variant?: "default" | "secondary" | "destructive" | "outline" | null | undefined, className?: string }) {
//     const baseClasses = "inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold";
//     const variantClasses = {
//         default: "bg-primary text-primary-foreground",
//         secondary: "bg-secondary text-secondary-foreground",
//         destructive: "bg-destructive text-destructive-foreground",
//         outline: "text-foreground border border-border",
//     };
//     return <span className={`${baseClasses} ${variantClasses[variant || 'secondary']} ${className}`}>{children}</span>;
// }
