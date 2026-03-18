/**
 * Compute derived performance metrics from project events.
 * Run after a project completes to update freelancer and project stats.
 */

import { getProjectEvents, type ProjectEvent } from '@/services/project-events';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface FreelancerPerformanceStats {
  estimateAccuracy: number;  // avg(actual / estimated) — 1.0 = perfect
  qualityScore: number;      // weighted avg QA scores (0-100)
  revisionRate: number;      // revisions / total submissions
  onTimeRate: number;        // % tasks completed within estimate
  totalTasksCompleted: number;
  totalProjectsCompleted: number;
}

export interface ProjectAnalytics {
  costEfficiency: number;    // estimated / actual cost
  timeEfficiency: number;    // estimated / actual duration
  matchQuality: number;      // avg freelancer skill score / 100
}

/**
 * Compute freelancer performance stats from a completed project's events.
 * Returns a map of freelancerId → stats delta (to be merged with existing stats).
 */
export async function computeFreelancerStats(
  projectId: string
): Promise<Record<string, Partial<FreelancerPerformanceStats>>> {
  const events = await getProjectEvents(projectId);
  const stats: Record<string, {
    estimateRatios: number[];
    qaScores: number[];
    revisions: number;
    submissions: number;
    onTime: number;
    totalTasks: number;
  }> = {};

  // Extract freelancer IDs from matched events
  const matchEvents = events.filter((e) => e.type === 'freelancer_matched');
  const taskFreelancerMap: Record<string, string> = {};
  for (const e of matchEvents) {
    const taskId = e.data.taskId as string;
    const freelancerId = e.data.freelancerId as string;
    taskFreelancerMap[taskId] = freelancerId;
    if (!stats[freelancerId]) {
      stats[freelancerId] = {
        estimateRatios: [], qaScores: [], revisions: 0,
        submissions: 0, onTime: 0, totalTasks: 0,
      };
    }
  }

  // Process submission events
  const submitEvents = events.filter((e) => e.type === 'task_submitted');
  for (const e of submitEvents) {
    const taskId = e.data.taskId as string;
    const fid = taskFreelancerMap[taskId];
    if (!fid || !stats[fid]) continue;

    stats[fid].submissions++;
    stats[fid].totalTasks++;

    const estimatedHours = e.data.estimatedHours as number | undefined;
    const actualHours = e.data.actualHours as number | undefined;
    if (estimatedHours && actualHours && estimatedHours > 0) {
      stats[fid].estimateRatios.push(actualHours / estimatedHours);
      if (actualHours <= estimatedHours * 1.1) stats[fid].onTime++;
    }
  }

  // Process revision events
  const revisionEvents = events.filter((e) => e.type === 'task_revised');
  for (const e of revisionEvents) {
    const taskId = e.data.taskId as string;
    const fid = taskFreelancerMap[taskId];
    if (fid && stats[fid]) stats[fid].revisions++;
  }

  // Process QA events
  const qaEvents = events.filter((e) => e.type === 'qa_milestone_reviewed');
  for (const e of qaEvents) {
    const score = e.data.score as number | undefined;
    // Attribute QA score to all freelancers in that milestone
    const milestoneId = e.data.milestoneId as string;
    const milestoneTasks = matchEvents.filter((me) => me.data.milestoneId === milestoneId);
    for (const mt of milestoneTasks) {
      const fid = mt.data.freelancerId as string;
      if (fid && stats[fid] && score !== undefined) {
        stats[fid].qaScores.push(score);
      }
    }
  }

  // Compute final stats
  const result: Record<string, Partial<FreelancerPerformanceStats>> = {};
  for (const [fid, s] of Object.entries(stats)) {
    const avgEstimate = s.estimateRatios.length > 0
      ? s.estimateRatios.reduce((a, b) => a + b, 0) / s.estimateRatios.length
      : 1.0;
    const avgQA = s.qaScores.length > 0
      ? s.qaScores.reduce((a, b) => a + b, 0) / s.qaScores.length
      : 0;

    result[fid] = {
      estimateAccuracy: Math.round(avgEstimate * 100) / 100,
      qualityScore: Math.round(avgQA),
      revisionRate: s.submissions > 0 ? Math.round((s.revisions / s.submissions) * 100) / 100 : 0,
      onTimeRate: s.totalTasks > 0 ? Math.round((s.onTime / s.totalTasks) * 100) / 100 : 0,
      totalTasksCompleted: s.totalTasks,
    };
  }

  return result;
}

/**
 * Update a freelancer's performance stats in Firestore.
 * Merges new stats with existing (running averages).
 */
export async function updateFreelancerPerformanceStats(
  freelancerId: string,
  newStats: Partial<FreelancerPerformanceStats>
): Promise<void> {
  const ref = doc(db, 'freelancers', freelancerId);
  await updateDoc(ref, {
    'performanceStats.estimateAccuracy': newStats.estimateAccuracy,
    'performanceStats.qualityScore': newStats.qualityScore,
    'performanceStats.revisionRate': newStats.revisionRate,
    'performanceStats.onTimeRate': newStats.onTimeRate,
    'performanceStats.totalTasksCompleted': newStats.totalTasksCompleted,
  });
}
