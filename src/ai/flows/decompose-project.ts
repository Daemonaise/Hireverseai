'use server';

/**
 * Project Decomposition Pipeline — 3-Stage Orchestrator
 *
 * Stage 1: analyzeProject — Identify categories, roles, complexity
 * Stage 2: generateProjectPlan — Create milestones + microtasks
 * Stage 3: freelancerMatcher — Match freelancers, calculate costs
 */

import { analyzeProject } from './analyze-project';
import { generateProjectPlan } from './generate-project-plan';
import type { AnalyzeProjectOutput } from '@/ai/schemas/analyze-project-schema';
import type { GenerateProjectPlanOutput, PlanTask } from '@/ai/schemas/generate-project-plan-schema';
import { matchFreelancersToTasks, type FreelancerCandidate, type MatchResult } from '@/lib/matching/freelancer-matcher';
import { calculateTotalProjectCost, shouldAutoAssign } from '@/lib/matching/cost-calculator';
import { updateProjectStatus } from '@/services/firestore';
import { createMilestone } from '@/services/milestones';
import { storeAssignments } from '@/services/assignments';
import type { ServiceCategory, ClientPriority, Milestone, Microtask } from '@/types/project';
import { Timestamp } from 'firebase/firestore';

export interface DecomposeInput {
  projectId: string;
  clientId: string;
  brief: string;
  category: ServiceCategory;
  clientPriority: ClientPriority;
  availableFreelancers: FreelancerCandidate[];
}

export interface DecomposeOutput {
  analysis: AnalyzeProjectOutput;
  plan: GenerateProjectPlanOutput;
  matching: MatchResult;
  autoAssigned: boolean;
  estimatedTotalCost: number;
}

export async function decomposeProject(input: DecomposeInput): Promise<DecomposeOutput> {
  await updateProjectStatus(input.projectId, 'planning');

  try {
    // Stage 1: Analyze
    const analysis = await analyzeProject({
      projectId: input.projectId,
      brief: input.brief,
      category: input.category,
      clientPriority: input.clientPriority,
    });

    // Stage 2: Generate plan
    const plan = await generateProjectPlan({
      projectId: input.projectId,
      brief: input.brief,
      projectTypes: analysis.projectTypes,
      requiredRoles: analysis.requiredRoles,
      complexity: analysis.complexity,
      estimatedTotalHours: analysis.estimatedTotalHours,
      suggestedMilestoneCount: analysis.suggestedMilestoneCount,
      clientPriority: input.clientPriority,
    });

    // Flatten tasks with milestoneId for matching
    const allTasks: Array<PlanTask & { milestoneId: string }> = [];
    for (const milestone of plan.milestones) {
      for (const task of milestone.tasks) {
        allTasks.push({ ...task, milestoneId: milestone.id });
      }
    }

    // Stage 3: Match freelancers
    const matching = matchFreelancersToTasks(
      allTasks,
      input.availableFreelancers,
      input.clientId,
      input.projectId,
      input.clientPriority
    );

    const autoAssigned = shouldAutoAssign(matching.totalCost);

    // Store milestones in Firestore
    for (const milestone of plan.milestones) {
      await createMilestone(input.projectId, {
        id: milestone.id,
        projectId: input.projectId,
        name: milestone.name,
        order: milestone.order,
        status: 'pending',
        dependencies: milestone.dependencies,
        qaGateEnabled: milestone.qaGateEnabled,
      });
    }

    // Store assignments
    if (matching.assignments.length > 0) {
      await storeAssignments(input.projectId, matching.assignments);
    }

    // Update project status
    if (autoAssigned) {
      await updateProjectStatus(input.projectId, 'assigned');
    } else {
      await updateProjectStatus(input.projectId, 'awaiting_approval');
    }

    return {
      analysis,
      plan,
      matching,
      autoAssigned,
      estimatedTotalCost: matching.totalCost,
    };
  } catch (error) {
    await updateProjectStatus(input.projectId, 'pending');
    throw error;
  }
}
