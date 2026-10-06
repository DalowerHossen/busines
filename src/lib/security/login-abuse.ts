import 'server-only';

import { createHash } from 'node:crypto';

export interface LoginAbuseState {
  readonly failureCount: number;
  readonly lockedUntil: string | null;
}

export interface LoginAbuseStore {
  get(key: string): Promise<LoginAbuseState>;
  recordFailure(input: {
    readonly key: string;
    readonly maxFailures: number;
    readonly windowSeconds: number;
    readonly lockoutSeconds: number;
  }): Promise<LoginAbuseState>;
  clear(key: string): Promise<void>;
}

export interface LoginAbusePolicy {
  readonly maxFailures: number;
  readonly windowSeconds: number;
  readonly lockoutSeconds: number;
}

export interface LoginAttemptDecision {
  readonly allowed: boolean;
  readonly locked: boolean;
  readonly failureCount: number;
  readonly lockedUntil: string | null;
}

export function loginAbuseKey(input: {
  readonly identifier: string;
  readonly ipAddress?: string;
}): string {
  const identifier = input.identifier.trim().toLowerCase();
  const ipAddress = (input.ipAddress ?? 'unknown').trim().toLowerCase();
  return `login:v1:${createHash('sha256').update(`${identifier}|${ipAddress}`, 'utf8').digest('hex')}`;
}

export async function checkLoginAllowed(input: {
  readonly store: LoginAbuseStore;
  readonly identifier: string;
  readonly ipAddress?: string;
}): Promise<LoginAttemptDecision> {
  const state = await input.store.get(loginAbuseKey(input));
  const locked = state.lockedUntil !== null && Date.parse(state.lockedUntil) > Date.now();
  return {
    allowed: !locked,
    locked,
    failureCount: state.failureCount,
    lockedUntil: locked ? state.lockedUntil : null,
  };
}

export async function recordFailedLogin(input: {
  readonly store: LoginAbuseStore;
  readonly identifier: string;
  readonly ipAddress?: string;
  readonly policy: LoginAbusePolicy;
}): Promise<LoginAttemptDecision> {
  validatePolicy(input.policy);
  const state = await input.store.recordFailure({
    key: loginAbuseKey(input),
    maxFailures: input.policy.maxFailures,
    windowSeconds: input.policy.windowSeconds,
    lockoutSeconds: input.policy.lockoutSeconds,
  });
  const locked = state.lockedUntil !== null && Date.parse(state.lockedUntil) > Date.now();
  return {
    allowed: !locked,
    locked,
    failureCount: state.failureCount,
    lockedUntil: locked ? state.lockedUntil : null,
  };
}

export async function clearFailedLogins(input: {
  readonly store: LoginAbuseStore;
  readonly identifier: string;
  readonly ipAddress?: string;
}): Promise<void> {
  await input.store.clear(loginAbuseKey(input));
}

function validatePolicy(policy: LoginAbusePolicy): void {
  if (
    !Number.isSafeInteger(policy.maxFailures) ||
    policy.maxFailures < 1 ||
    !Number.isSafeInteger(policy.windowSeconds) ||
    policy.windowSeconds < 1 ||
    !Number.isSafeInteger(policy.lockoutSeconds) ||
    policy.lockoutSeconds < 1
  ) {
    throw new Error('Login abuse policy is invalid.');
  }
}
