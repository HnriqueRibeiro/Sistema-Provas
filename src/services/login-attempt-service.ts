import { createHash } from "node:crypto";

const MAX_FAILED_ATTEMPTS = 3;
const BLOCK_DURATION_MS = 5 * 60 * 1000;
const ENTRY_TTL_MS = 15 * 60 * 1000;

interface LoginAttemptEntry {
  failures: number;
  blockedUntil: number | null;
  updatedAt: number;
}

export interface LoginAttemptState {
  blocked: boolean;
  attemptsRemaining: number;
  retryAfterSeconds?: number;
}

const attempts = new Map<string, LoginAttemptEntry>();

function fingerprint(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function createKey(email: string, ip: string) {
  return fingerprint(`${ip}:${email.trim().toLowerCase()}`);
}

function cleanup(now: number) {
  if (attempts.size < 500) return;

  for (const [key, entry] of attempts.entries()) {
    const blockExpired = !entry.blockedUntil || entry.blockedUntil <= now;
    if (blockExpired && now - entry.updatedAt > ENTRY_TTL_MS) {
      attempts.delete(key);
    }
  }
}

export function getLoginAttemptState(email: string, ip: string): LoginAttemptState {
  const now = Date.now();
  cleanup(now);
  const key = createKey(email, ip);
  const entry = attempts.get(key);

  if (!entry) {
    return { blocked: false, attemptsRemaining: MAX_FAILED_ATTEMPTS };
  }

  if (entry.blockedUntil && entry.blockedUntil > now) {
    return {
      blocked: true,
      attemptsRemaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.blockedUntil - now) / 1000)),
    };
  }

  if (entry.blockedUntil && entry.blockedUntil <= now) {
    attempts.delete(key);
    return { blocked: false, attemptsRemaining: MAX_FAILED_ATTEMPTS };
  }

  return {
    blocked: false,
    attemptsRemaining: Math.max(0, MAX_FAILED_ATTEMPTS - entry.failures),
  };
}

export function registerLoginFailure(email: string, ip: string): LoginAttemptState {
  const now = Date.now();
  const key = createKey(email, ip);
  const current = attempts.get(key);
  const failures = (current?.failures ?? 0) + 1;

  if (failures >= MAX_FAILED_ATTEMPTS) {
    const blockedUntil = now + BLOCK_DURATION_MS;
    attempts.set(key, { failures, blockedUntil, updatedAt: now });

    return {
      blocked: true,
      attemptsRemaining: 0,
      retryAfterSeconds: Math.ceil(BLOCK_DURATION_MS / 1000),
    };
  }

  attempts.set(key, { failures, blockedUntil: null, updatedAt: now });

  return {
    blocked: false,
    attemptsRemaining: MAX_FAILED_ATTEMPTS - failures,
  };
}

export function clearLoginFailures(email: string, ip: string) {
  attempts.delete(createKey(email, ip));
}

export const loginAttemptConfig = {
  maxFailedAttempts: MAX_FAILED_ATTEMPTS,
  blockDurationMinutes: BLOCK_DURATION_MS / 60_000,
};
