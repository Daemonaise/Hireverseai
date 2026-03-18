
'use server';

/**
 * @fileOverview Service functions for freelancer data.
 */

import type { Freelancer } from '@/types/freelancer';
import { getAvailableFreelancersBySkill } from '@/services/firestore';
import { dummyFreelancers } from '@/lib/dummy-data'; // Import dummy data

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
    return [];
  }

  try {
    // Filter dummy data instead of calling Firestore
    const availableFreelancers = dummyFreelancers.filter(f => f.status === 'available');

    const matchedFreelancers = availableFreelancers.filter(freelancer => {
        const freelancerSkills = new Set(freelancer.skills.map(s => s.toLowerCase()));
        return skills.some(requiredSkill => freelancerSkills.has(requiredSkill.toLowerCase()));
    });

    // Sort by rating (desc) as a primary sort key, then XP (desc) as secondary
    matchedFreelancers.sort((a, b) => {
        if ((b.rating ?? 0) !== (a.rating ?? 0)) {
            return (b.rating ?? 0) - (a.rating ?? 0);
        }
        return (b.xp ?? 0) - (a.xp ?? 0);
    });

    return matchedFreelancers.slice(0, limit);

  } catch (error) {
    throw new Error(`Failed to fetch freelancers: ${(error as Error).message}`);
  }
}
