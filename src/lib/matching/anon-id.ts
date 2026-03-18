/**
 * Generate a deterministic anonymous ID for a freelancer.
 * Same freelancer + same client always produces the same anon ID.
 * Different client produces different anon ID (salted with clientId).
 */

const SALT = 'hireverse-anon-2026';

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function generateAnonId(freelancerId: string, clientId: string): string {
  const hash = hashString(`${freelancerId}:${clientId}:${SALT}`);
  const digits = String(hash % 10000).padStart(4, '0');
  return `FL-${digits}`;
}
