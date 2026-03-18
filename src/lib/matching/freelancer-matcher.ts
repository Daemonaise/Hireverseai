/**
 * Stage 3: Cost-optimized freelancer matching.
 * For each microtask, find the best freelancer based on client priority.
 */

import type { ClientPriority, FreelancerAssignment } from '@/types/project';
import type { CertificationLevel } from '@/types/assessment';
import type { PlanTask } from '@/ai/schemas/generate-project-plan-schema';
import { generateAnonId } from './anon-id';
import { calculateTaskCost } from './cost-calculator';
import { Timestamp } from 'firebase/firestore';

// Certification level ordering for comparison
const CERT_ORDER: Record<CertificationLevel, number> = {
  uncertified: 0,
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4,
  master: 5,
};

export interface FreelancerCandidate {
  id: string;
  skills: string[];
  certificationLevel: CertificationLevel;
  skillScores: Record<string, number>;
  payRateMultiplier: number;
  isAvailable: boolean;
}

export interface MatchResult {
  assignments: FreelancerAssignment[];
  totalCost: number;
  unmatched: string[]; // task IDs with no available freelancer
}

/**
 * Match freelancers to tasks based on client priority.
 */
export function matchFreelancersToTasks(
  tasks: Array<PlanTask & { milestoneId: string }>,
  candidates: FreelancerCandidate[],
  clientId: string,
  projectId: string,
  priority: ClientPriority
): MatchResult {
  const assignments: FreelancerAssignment[] = [];
  const unmatched: string[] = [];
  const freelancerLoad: Record<string, number> = {}; // track hours assigned

  for (const task of tasks) {
    // Filter candidates: must have the required skill and meet minimum cert level
    const qualified = candidates.filter((c) => {
      if (!c.isAvailable) return false;
      const hasSkill = c.skills.some(
        (s) => s.toLowerCase() === task.requiredSkill.toLowerCase()
      );
      if (!hasSkill) return false;
      const certMet = CERT_ORDER[c.certificationLevel] >=
        CERT_ORDER[task.minCertificationLevel as CertificationLevel];
      return certMet;
    });

    if (qualified.length === 0) {
      unmatched.push(task.id);
      continue;
    }

    // Sort based on priority
    const sorted = [...qualified].sort((a, b) => {
      switch (priority) {
        case 'budget':
          return a.payRateMultiplier - b.payRateMultiplier;

        case 'quality': {
          const aScore = a.skillScores[task.requiredSkill] ?? 0;
          const bScore = b.skillScores[task.requiredSkill] ?? 0;
          return bScore - aScore; // highest score first
        }

        case 'speed': {
          // Prefer freelancers with less current load + higher scores
          const aLoad = freelancerLoad[a.id] ?? 0;
          const bLoad = freelancerLoad[b.id] ?? 0;
          const aScore = a.skillScores[task.requiredSkill] ?? 0;
          const bScore = b.skillScores[task.requiredSkill] ?? 0;
          // Less load is better, then higher score
          return (aLoad - bLoad) || (bScore - aScore);
        }

        default:
          return 0;
      }
    });

    // Check for consolidation — prefer a freelancer already assigned to this project
    const alreadyAssigned = sorted.find((c) =>
      assignments.some((a) => a.freelancerId === c.id)
    );
    const winner = alreadyAssigned ?? sorted[0];

    const cost = calculateTaskCost(task.estimatedHours, winner.payRateMultiplier);
    freelancerLoad[winner.id] = (freelancerLoad[winner.id] ?? 0) + task.estimatedHours;

    assignments.push({
      id: `assign_${task.id}_${Date.now()}`,
      projectId,
      milestoneId: task.milestoneId,
      microtaskId: task.id,
      freelancerId: winner.id,
      anonId: generateAnonId(winner.id, clientId),
      skillScore: winner.skillScores[task.requiredSkill] ?? 0,
      certificationLevel: winner.certificationLevel,
      payRateMultiplier: winner.payRateMultiplier,
      estimatedCost: cost,
      assignedAt: Timestamp.now(),
    });
  }

  const totalCost = assignments.reduce((sum, a) => sum + a.estimatedCost, 0);

  return { assignments, totalCost, unmatched };
}
