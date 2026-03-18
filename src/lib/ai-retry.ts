/**
 * Retry wrapper for AI generation calls.
 * Retries on transient failures with exponential backoff.
 */

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

const DEFAULTS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 5000,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const opts = { ...DEFAULTS, ...options };
  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < opts.maxAttempts) {
        const delay = Math.min(
          opts.baseDelayMs * Math.pow(2, attempt - 1),
          opts.maxDelayMs
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
