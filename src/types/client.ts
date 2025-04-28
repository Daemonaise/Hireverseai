
import type { Timestamp } from 'firebase/firestore';
import type Stripe from 'stripe'; // Import Stripe type

/**
 * Represents the structure of a Client document in Firestore.
 * Authentication details (password) are handled separately.
 */
export interface Client {
  id: string; // Firestore document ID, typically matches the Auth User ID.
  name: string; // Client's name or Company name
  email: string; // Business email
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  // MFA fields
  mfaSecret?: string | null; // Unique TOTP secret key for this user (store securely!)
  isMfaEnabled?: boolean; // Flag indicating if MFA is currently enabled
  // Stripe Subscription fields
  subscriptionStatus?: Stripe.Subscription.Status | 'inactive'; // Track subscription status
  stripeSubscriptionId?: string | null; // Store the Stripe Subscription ID
  // Add other relevant client fields if needed (e.g., company details)
}
