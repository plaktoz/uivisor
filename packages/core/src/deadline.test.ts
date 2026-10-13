import { describe, it, expect, vi } from 'vitest';
import {
  createDeadline,
  retryUntil,
  DEFAULT_TIMEOUTS,
  RETRY_INTERVAL_MS,
  type Clock,
  type Attempt,
} from './deadline.js';

/** A fully deterministic fake clock: now() advances only via advance(), sleep() advances itself. */
function makeFakeClock(): Clock & { advance(ms: number): void; now(): number } {
  let t = 0;
  return {
    now: () => t,
    sleep: async (ms: number) => {
      t += ms;
    },
    advance(ms: number) {
      t += ms;
    },
  };
}

describe('createDeadline', () => {
  it('exposes timeoutMs unchanged', () => {
    const deadline = createDeadline(1234);
    expect(deadline.timeoutMs).toBe(1234);
  });

  it('remainingMs() counts down on the injected clock, floored at 0 after expiry', () => {
    const clock = makeFakeClock();
    const deadline = createDeadline(1000, clock);
    expect(deadline.remainingMs()).toBe(1000);
    clock.advance(400);
    expect(deadline.remainingMs()).toBe(600);
    clock.advance(700);
    expect(deadline.remainingMs()).toBe(0);
  });

  it('remainingMs() is Infinity for timeoutMs=0 (unbounded)', () => {
    const clock = makeFakeClock();
    const deadline = createDeadline(0, clock);
    expect(deadline.remainingMs()).toBe(Infinity);
    clock.advance(1_000_000);
    expect(deadline.remainingMs()).toBe(Infinity);
  });

  it('expired() is false before the deadline, true at/after it', () => {
    const clock = makeFakeClock();
    const deadline = createDeadline(500, clock);
    expect(deadline.expired()).toBe(false);
    clock.advance(499);
    expect(deadline.expired()).toBe(false);
    clock.advance(1);
    expect(deadline.expired()).toBe(true);
    clock.advance(100);
    expect(deadline.expired()).toBe(true);
  });

  it('pwTimeout() returns ceil(remainingMs()), minimum 1 — never 0 for a bounded deadline, even at expiry', () => {
    const clock = makeFakeClock();
    const deadline = createDeadline(1000, clock);
    expect(deadline.pwTimeout()).toBe(1000);
    clock.advance(1000);
    expect(deadline.pwTimeout()).toBe(1);
  });

  it('pwTimeout() ceils sub-millisecond remaining time to the full value', () => {
    // Using performance.now()-based real clock implicitly via sub-ms deltas is covered
    // by the exact {timeout: 30000}/{timeout:5000} assertions elsewhere; here we assert
    // the ceil behaviour directly against a clock with fractional remaining time.
    let t = 0;
    const clock: Clock = { now: () => t, sleep: async (ms) => { t += ms; } };
    const deadline = createDeadline(1000, clock);
    t = 0.3; // 999.7 ms remaining
    expect(deadline.pwTimeout()).toBe(1000);
  });

  it('pwTimeout() returns 0 for an unbounded deadline', () => {
    const clock = makeFakeClock();
    const deadline = createDeadline(0, clock);
    expect(deadline.pwTimeout()).toBe(0);
  });

  it('sleep(ms) caps the requested duration at remainingMs()', async () => {
    let requested: number | undefined;
    let t = 0;
    const clock: Clock = {
      now: () => t,
      sleep: async (ms) => {
        requested = ms;
        t += ms;
      },
    };
    const deadline = createDeadline(50, clock);
    await deadline.sleep(100);
    expect(requested).toBe(50);
  });

  it('DEFAULT_TIMEOUTS === { defaultTimeout: 5000, navigationTimeout: 30000 }', () => {
    expect(DEFAULT_TIMEOUTS).toEqual({ defaultTimeout: 5000, navigationTimeout: 30000 });
  });

  it('RETRY_INTERVAL_MS === 100', () => {
    expect(RETRY_INTERVAL_MS).toBe(100);
  });

  it('two independently-created Deadlines on two independent fake clocks do not share state', () => {
    const clockA = makeFakeClock();
    const clockB = makeFakeClock();
    const a = createDeadline(1000, clockA);
    const b = createDeadline(1000, clockB);
    clockA.advance(900);
    expect(a.remainingMs()).toBe(100);
    expect(b.remainingMs()).toBe(1000);
  });
});

describe('retryUntil', () => {
  it('runs attempt once immediately, even on an already-expired deadline', async () => {
    const clock = makeFakeClock();
    const expired = createDeadline(1, clock);
    clock.advance(1);
    expect(expired.expired()).toBe(true);
    const attempt = vi.fn<() => Promise<Attempt<string, number>>>().mockResolvedValue({ done: true, value: 'ok' });
    const result = await retryUntil(expired, attempt);
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ done: true, value: 'ok' });
  });

  it('returns the first done result without further polling; sleep is never called', async () => {
    const clock = makeFakeClock();
    const sleepSpy = vi.spyOn(clock, 'sleep');
    const deadline = createDeadline(1000, clock);
    const attempt = vi.fn<() => Promise<Attempt<string, number>>>().mockResolvedValue({ done: true, value: 'ok' });
    const result = await retryUntil(deadline, attempt);
    expect(result).toEqual({ done: true, value: 'ok' });
    expect(sleepSpy).not.toHaveBeenCalled();
  });

  it('polls every 100ms via deadline.sleep until done', async () => {
    const clock = makeFakeClock();
    const sleepSpy = vi.spyOn(clock, 'sleep');
    const deadline = createDeadline(1000, clock);
    const attempt = vi
      .fn<() => Promise<Attempt<string, number>>>()
      .mockResolvedValueOnce({ done: false, last: 0 })
      .mockResolvedValueOnce({ done: false, last: 0 })
      .mockResolvedValueOnce({ done: true, value: 'ok' });
    const result = await retryUntil(deadline, attempt);
    expect(result).toEqual({ done: true, value: 'ok' });
    expect(sleepSpy).toHaveBeenCalledTimes(2);
    expect(sleepSpy).toHaveBeenCalledWith(100);
  });

  it("retryUntil's last attempt lands exactly on the deadline", async () => {
    const clock = makeFakeClock();
    const deadline = createDeadline(1000, clock);
    const attempt = vi.fn<() => Promise<Attempt<string, number>>>().mockResolvedValue({ done: false, last: 0 });
    const result = await retryUntil(deadline, attempt);
    expect(result).toEqual({ done: false, last: 0 });
    // attempts at t=0,100,...,1000 => 11 attempts
    expect(attempt).toHaveBeenCalledTimes(11);
  });

  it('returns the last not-done result at the deadline, never throwing', async () => {
    const clock = makeFakeClock();
    const deadline = createDeadline(300, clock);
    const attempt = vi
      .fn<() => Promise<Attempt<string, number>>>()
      .mockResolvedValueOnce({ done: false, last: 1 })
      .mockResolvedValueOnce({ done: false, last: 2 })
      .mockResolvedValueOnce({ done: false, last: 3 })
      .mockResolvedValueOnce({ done: false, last: 4 });
    await expect(retryUntil(deadline, attempt)).resolves.toEqual({ done: false, last: 4 });
  });

  it('propagates an attempt() rejection immediately, without retrying', async () => {
    const clock = makeFakeClock();
    const sleepSpy = vi.spyOn(clock, 'sleep');
    const deadline = createDeadline(1000, clock);
    const err = new Error('boom');
    const attempt = vi.fn<() => Promise<Attempt<string, number>>>().mockRejectedValue(err);
    await expect(retryUntil(deadline, attempt)).rejects.toThrow('boom');
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(sleepSpy).not.toHaveBeenCalled();
  });
});
