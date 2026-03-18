import { Timestamp } from 'firebase/firestore';

/**
 * Safely convert a Firestore Timestamp (or unknown value) to a JS Date.
 * Handles: Timestamp objects, Date objects, ISO strings, and null/undefined.
 */
export function toDate(value: unknown): Date {
  if (!value) return new Date();
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  if (typeof value === 'object' && 'toDate' in value && typeof (value as any).toDate === 'function') {
    return (value as any).toDate();
  }
  return new Date();
}

/**
 * Format a Firestore Timestamp as a localized time string (HH:MM).
 */
export function formatTime(value: unknown): string {
  return toDate(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/**
 * Format a Firestore Timestamp as a short date (e.g., "Mar 18").
 */
export function formatShortDate(value: unknown): string {
  return toDate(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Format a Firestore Timestamp as a relative string (just now, 5m ago, 2h ago, etc.).
 */
export function formatRelative(value: unknown): string {
  const date = toDate(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatShortDate(value);
}
