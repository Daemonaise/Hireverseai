import type { Timestamp } from 'firebase/firestore';
import type { CertificationLevel } from './assessment';

// --- Service Categories ---

export type ServiceCategory =
  | 'programming' | 'design' | 'writing' | 'marketing'
  | 'video' | 'music' | 'business' | 'translation' | 'ai_data';

export type ClientPriority = 'speed' | 'quality' | 'budget';
export type ProjectComplexity = 'simple' | 'moderate' | 'complex';

// --- Project Status ---

export type ProjectStatus =
  | 'pending'
  | 'planning'              // AI running 3-stage pipeline
  | 'awaiting_approval'     // Plan shown to client ($500+)
  | 'decomposing'           // Legacy — AI breaking down brief
  | 'decomposed'
  | 'assigned'
  | 'milestone_active'      // At least one milestone in progress
  | 'in_progress'
  | 'qa_review'             // Milestone QA gate evaluating
  | 'change_requested'
  | 'change_approved'
  | 'review'
  | 'completed'
  | 'cancelled'
  | 'no_candidates';

export type ProjectPaymentStatus = 'pending' | 'paid' | 'payment_failed';

// --- Milestone ---

export type MilestoneStatus = 'pending' | 'in_progress' | 'qa_review' | 'approved' | 'failed_qa';

export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  order: number;
  status: MilestoneStatus;
  dependencies: string[]; // milestone IDs that must complete first
  qaGateEnabled: boolean;
  qaScore?: number; // 0-100
  qaFeedback?: string;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
}

// --- Microtask ---

export interface Microtask {
  id: string;
  description: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'submitted' | 'approved' | 'rejected';
  milestoneId: string;
  role: string; // e.g., "frontend_developer"
  requiredSkill: string;
  minCertificationLevel: CertificationLevel;
  parallelGroup: string; // tasks with same group run simultaneously
  estimatedHours: number;
  estimatedCost: number;
  actualCost?: number;
  assignedFreelancerId?: string;
  assignedFreelancerAnonId?: string; // "FL-XXXX"
  dependencies: string[]; // task IDs
  submittedWorkUrl?: string;
  feedback?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

// --- Freelancer Assignment (internal, never client-facing) ---

export interface FreelancerAssignment {
  id: string;
  projectId: string;
  milestoneId: string;
  microtaskId: string;
  freelancerId: string;
  anonId: string; // "FL-XXXX"
  skillScore: number;
  certificationLevel: CertificationLevel;
  payRateMultiplier: number;
  estimatedCost: number;
  assignedAt: Timestamp;
}

// --- Change Request ---

export interface ChangeRequest {
  id: string;
  requestedBy: string;
  description: string;
  priority: 'Normal' | 'High';
  fileUrl?: string;
  status: 'pending_estimate' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled';
  estimatedNewCompletionDate?: Timestamp;
  estimatedAdditionalCost?: number;
  requestedAt: Timestamp;
  updatedAt?: Timestamp;
}

// --- Project ---

export interface Project {
  id?: string;
  clientId: string;
  name: string;
  brief: string;
  category: ServiceCategory;
  clientPriority: ClientPriority;
  complexity: ProjectComplexity;
  requiredSkills: string[];
  requiredRoles: string[];
  status: ProjectStatus;
  paymentStatus: ProjectPaymentStatus;
  autoAssigned: boolean; // true if under $500 threshold
  estimatedTotalCost: number;
  assignedFreelancerId?: string; // For simple single-freelancer projects
  estimatedDeliveryDate?: Timestamp;
  progress?: number; // 0-100
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  deliveredUrl?: string;
  externalSourceData?: {
    id: string;
    system: string;
  };
}
