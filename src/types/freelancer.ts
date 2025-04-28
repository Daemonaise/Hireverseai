
import type { Timestamp } from 'firebase/firestore';

/**
 * Represents the possible availability statuses for a freelancer.
 */
export type FreelancerStatus = 'available' | 'busy' | 'offline';

/**
 * Represents the structure of a Freelancer document in Firestore.
 * Note: The password is NOT stored here. Authentication is handled separately.
 */
export interface Freelancer {
  id: string; // Firestore document ID, typically matches the Auth User ID.
  name: string;
  email: string; // Used for login identification, but password is not stored.
  skills: string[]; // List of skills identified (potentially updated after assessment)
  testScores?: { [skill: string]: number }; // Optional: Scores for each skill test (might be deprecated for adaptive)
  assessmentResultId?: string | null; // Optional: ID linking to the AdaptiveAssessmentResult document
  xp?: number; // Experience points for gamification
  badges?: string[]; // Array of badge IDs earned
  createdAt: Timestamp; // Timestamp of creation
  updatedAt?: Timestamp; // Timestamp of last update
  isLoggedIn?: boolean; // Tracks if the freelancer is currently logged in (based on session/token)
  status?: FreelancerStatus; // Tracks the freelancer's self-reported availability
  currentProjects?: string[]; // Optional: List of project IDs currently assigned
  // MFA fields
  mfaSecret?: string | null; // Unique TOTP secret key for this user (store securely!)
  isMfaEnabled?: boolean; // Flag indicating if MFA is currently enabled
}
