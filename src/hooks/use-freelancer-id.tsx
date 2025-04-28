
'use client'; // This hook uses browser-specific APIs (searchParams)

import { useSearchParams } from 'next/navigation';

// Define placeholder ID constant
const PLACEHOLDER_ID = "PLACEHOLDER_ID";

/**
 * Custom hook to retrieve the freelancer ID from the URL search parameters.
 * Returns a placeholder if the 'id' parameter is not found.
 */
export function useFreelancerId(): string {
  const searchParams = useSearchParams();
  // Use optional chaining and nullish coalescing for safety
  const id = searchParams?.get('id') ?? PLACEHOLDER_ID;
  // console.log(`useFreelancerId hook: Found ID = ${id}`); // Optional: for debugging
  return id;
}
