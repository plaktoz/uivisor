import type { TimeoutSettings } from './types.js';

/** Minimal clock abstraction so tests can drive time deterministically. */
export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export const realClock: Clock = {
  now: () => performance.now(),
  sleep: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/**
 * A single command's time budget. `timeoutMs === 0` means unbounded (only
 * `waitForPageLoad`'s inner `timeout: 0`).
 */
export interface Deadline {
  readonly timeoutMs: number;
  remainingMs(): number;
  expired(): boolean;
  pwTimeout(): number;
  sleep(ms: number): Promise<void>;
}

export function createDeadline(timeoutMs: number, clock: Clock = realClock): Deadline {
  const start = clock.now();
  const unbounded = timeoutMs === 0;
  const end = start + timeoutMs;

  function remainingMs(): number {
    if (unbounded) return Infinity;
    return Math.max(0, end - clock.now());
  }

  return {
    timeoutMs,
    remainingMs,
    expired() {
      if (unbounded) return false;
      return clock.now() >= end;
    },
    pwTimeout() {
      if (unbounded) return 0;
      return Math.max(1, Math.ceil(remainingMs()));
    },
    sleep(ms: number) {
      return clock.sleep(Math.min(ms, remainingMs()));
    },
  };
}

export const DEFAULT_TIMEOUTS: TimeoutSettings = { defaultTimeout: 5000, navigationTimeout: 30000 };

export const RETRY_INTERVAL_MS = 100;

export type Attempt<T, L> = { done: true; value: T } | { done: false; last: L };

/**
 * The one polling loop. Runs `attempt` immediately (even on an already-expired
 * deadline). Returns the first `done` result; if the deadline expires first,
 * returns the last not-done result. Never retries after `attempt` rejects.
 */
export async function retryUntil<T, L>(
  deadline: Deadline,
  attempt: () => Promise<Attempt<T, L>>,
): Promise<Attempt<T, L>> {
  let result = await attempt();
  while (!result.done) {
    if (deadline.expired()) return result;
    await deadline.sleep(RETRY_INTERVAL_MS);
    result = await attempt();
  }
  return result;
}
