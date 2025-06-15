
'use server';

/**
 * @fileOverview Service functions for freelancer data.
 */

import type { Freelancer } from '@/types/freelancer';
import { getAvailableFreelancersBySkill } from '@/services/firestore';

/**
 * Profile information for a freelancer, potentially a subset of the full Freelancer type.
 * For now, it's an alias to the main Freelancer type.
 */
export type FreelancerProfile = Freelancer;

/**
 * Fetches freelancers based on a list of skills.
 * This function can act as a wrapper or extension to the existing firestore query.
 * @param skills - An array of skill strings to match.
 * @param limit - Maximum number of freelancers to return (defaults to 10).
 * @returns A promise that resolves to an array of FreelancerProfile objects.
 */
export async function fetchFreelancersBySkills(skills: string[], limit: number = 10): Promise<FreelancerProfile[]> {
  if (!skills || skills.length === 0) {
    console.warn('[fetchFreelancersBySkills] No skills provided, returning empty array.');
    return [];
  }

  try {
    // Utilize the existing Firestore query function
    const freelancers = await getAvailableFreelancersBySkill(skills, limit);
    // The Freelancer type from firestore should already include hourlyRate and rating after the update.
    return freelancers as FreelancerProfile[];
  } catch (error) {
    console.error(`[fetchFreelancersBySkills] Error fetching freelancers by skills (${skills.join(', ')}):`, error);
    // Depending on error handling strategy, either re-throw or return empty/error indicator
    throw new Error(`Failed to fetch freelancers: ${(error as Error).message}`);
  }
}
