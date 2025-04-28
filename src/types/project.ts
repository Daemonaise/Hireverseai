import type { Timestamp } from 'firebase/firestore';

/**
 * Represents the status of a project.
 */
export type ProjectStatus =
 | 'pending' // Waiting for payment or initial setup
 | 'decomposing' // AI is breaking down the brief
 | 'decomposed' // Ready for microtask assignment
 | 'assigned' // Assigned to freelancer(s)
 | 'in_progress'
 | 'change_requested' // Client requested a change, pending estimate/approval
 | 'change_approved' // Change approved, work may need adjustments
 | 'review' // Work submitted, pending QA/client review
 | 'completed'
 | 'cancelled';

 /**
  * Represents the payment status of a project.
  */
 export type ProjectPaymentStatus = 'pending' | 'paid' | 'payment_failed';

/**
 * Represents a single microtask within a project.
 */
export interface Microtask {
    id: string; // Unique ID within the project (e.g., "task-001")
    description: string; // Detailed description of the task
    status: 'pending' | 'assigned' | 'in_progress' | 'submitted' | 'approved' | 'rejected';
    assignedFreelancerId?: string; // ID of the freelancer assigned to this task
    estimatedHours?: number; // AI's estimate for this task
    requiredSkill?: string; // Primary skill needed for this task
    dependencies?: string[]; // IDs of other microtasks that must be completed first
    submittedWorkUrl?: string; // URL to the submitted work (if applicable)
    feedback?: string; // AI or peer review feedback
    createdAt: Timestamp;
    updatedAt?: Timestamp;
}

/**
 * Represents a change request associated with a project.
 */
export interface ChangeRequest {
    id: string; // Unique ID for the change request
    requestedBy: string; // Client ID
    description: string;
    priority: 'Normal' | 'High';
    fileUrl?: string; // Optional file attachment URL
    status: 'pending_estimate' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled';
    estimatedNewCompletionDate?: Timestamp;
    estimatedAdditionalCost?: number;
    requestedAt: Timestamp;
    updatedAt?: Timestamp;
}

/**
 * Represents the structure of a Project document in Firestore.
 */
export interface Project {
    id?: string; // Firestore document ID
    clientId: string; // ID of the client who owns the project
    name: string;
    brief: string;
    requiredSkills: string[];
    status: ProjectStatus;
    paymentStatus: ProjectPaymentStatus; // Track payment specifically
    assignedFreelancerId?: string; // Could be a single freelancer or managed via microtasks
    // microtasks?: Microtask[]; // Stored in subcollection
    // changeRequests?: ChangeRequest[]; // Stored in subcollection
    estimatedDeliveryDate?: Timestamp; // Added estimated delivery date
    progress?: number; // Optional progress percentage (0-100)
    // Add other relevant fields like budget, client info, etc.
    createdAt: Timestamp;
    updatedAt?: Timestamp;
    deliveredUrl?: string; // URL to the final aggregated deliverable
}
