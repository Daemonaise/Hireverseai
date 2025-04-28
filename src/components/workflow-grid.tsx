
'use client';

import * as React from 'react';
import { FileText, BrainCircuit, Split, CheckCircle, Rocket, GanttChart } from 'lucide-react'; // Added GanttChart
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface WorkflowGridStepProps {
  icon: React.ElementType;
  title: string;
  description: string;
}

const WorkflowGridStep: React.FC<WorkflowGridStepProps> = ({ icon: Icon, title, description }) => {
  return (
    <Card className="flex flex-col h-full shadow-sm hover:shadow-md transition-shadow duration-300 rounded-lg overflow-hidden">
      <CardHeader className="flex flex-row items-center gap-4 pb-2">
        <div className="p-2 rounded-full bg-primary/10 border border-primary/20">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pt-1 text-sm text-muted-foreground">
        {description}
      </CardContent>
    </Card>
  );
};

const workflowStepsData = [
  {
    icon: FileText,
    title: 'Submit Brief',
    description: 'Easily submit your project details, goals, and preferences to get started.',
  },
  {
    icon: BrainCircuit,
    title: 'AI Match',
    description: 'Our AI instantly analyzes your brief and matches you with top-vetted freelancers across skillsets.',
  },
  {
    icon: Split,
    title: 'Microtasks',
    description: 'Your project is intelligently broken into microtasks so multiple experts can work simultaneously.',
  },
  {
    icon: GanttChart, // Changed icon
    title: 'Project Updates',
    description: 'Track real-time progress, communicate with your team, and request updates or change orders as needed.',
  },
  {
    icon: CheckCircle,
    title: 'QA',
    description: 'Every deliverable goes through automated quality checks and optional peer review for precision.',
  },
  {
    icon: Rocket,
    title: 'Delivery',
    description: 'Receive your completed project, assembled seamlessly from all microtasks, ready to use or launch.',
  },
];

export function WorkflowGrid() {
  return (
    // Use responsive grid layout. Removed max-w and mx-auto to let parent control alignment.
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 w-full">
      {workflowStepsData.map((step) => (
        <WorkflowGridStep
          key={step.title}
          icon={step.icon}
          title={step.title}
          description={step.description}
        />
      ))}
    </div>
  );
}
